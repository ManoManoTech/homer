import type {
  ChatPostMessageArguments,
  ChatUpdateArguments,
  ContextBlock,
  KnownBlock,
  MrkdwnElement,
  SectionBlock,
} from '@slack/web-api';
import {
  MERGE_REQUEST_CLOSE_STATES,
  MERGE_REQUEST_OPEN_STATES,
} from '@/constants';
import {
  fetchMergeRequestApprovers,
  fetchMergeRequestByIid,
  fetchProjectById,
  fetchReviewers,
} from '@/core/services/gitlab';
import {
  escapeText,
  fetchSlackUserFromGitlabUser,
  fetchSlackUsersFromGitlabUsers,
} from '@/core/services/slack';
import type { GitlabMergeRequestDetails } from '@/core/typings/GitlabMergeRequest';
import type { GitlabPipelineStatus } from '@/core/typings/GitlabPipeline';
import type { GitlabProjectDetails } from '@/core/typings/GitlabProject';
import { type SlackUser } from '@/core/typings/SlackUser';
import { injectActionsParameters } from '@/core/utils/slackActions';

export function buildReviewMessage(
  channelId: string,
  projectId: number,
  mergeRequestIid: number,
): Promise<ChatPostMessageArguments>;

export function buildReviewMessage(
  channelId: string,
  projectId: number,
  mergeRequestIid: number,
  ts: string,
): Promise<ChatUpdateArguments>;

export async function buildReviewMessage(
  channelId: string,
  projectId: number,
  mergeRequestIid: number,
  ts?: string,
) {
  const mergeRequest = await fetchMergeRequestByIid(projectId, mergeRequestIid);
  const [
    slackAssignees,
    approvalInfo,
    mergeRequestAuthor,
    slackReviewers,
    project,
  ] = await Promise.all([
    fetchSlackUsersFromGitlabUsers(mergeRequest.assignees),
    fetchMergeRequestApprovers(projectId, mergeRequestIid).then(
      async (info) => ({
        approvers: await fetchSlackUsersFromGitlabUsers(info.approvers),
        approvals_required: info.approvals_required,
        approvals_left: info.approvals_left,
      }),
    ),
    fetchSlackUserFromGitlabUser(mergeRequest.author),
    fetchReviewers(projectId, mergeRequestIid).then(
      fetchSlackUsersFromGitlabUsers,
    ),
    fetchProjectById(projectId),
  ]);

  const mergeRequestTitle = MERGE_REQUEST_CLOSE_STATES.includes(
    mergeRequest.state,
  )
    ? `~${escapeText(mergeRequest.title)}~`
    : escapeText(mergeRequest.title);

  const mergeRequestStatus = MERGE_REQUEST_OPEN_STATES.includes(
    mergeRequest.state,
  )
    ? ''
    : ` (${mergeRequest.state})`;

  const blocks = [
    buildHeaderBlock(mergeRequest, projectId),
    buildContextBlock(mergeRequest, project),
  ] as KnownBlock[];

  const peopleSection = buildPeopleSection(
    slackAssignees,
    slackReviewers,
    approvalInfo,
  );
  if (peopleSection) {
    blocks.push(peopleSection);
  }

  const message: ChatPostMessageArguments = {
    channel: channelId,
    link_names: true,
    text: `${mergeRequestTitle} ${mergeRequest.web_url}${mergeRequestStatus}`,
    blocks,
  };

  if (mergeRequestAuthor !== undefined) {
    message.username = mergeRequestAuthor.real_name;
    message.icon_url = mergeRequestAuthor.profile.image_72;
  }

  if (ts !== undefined) {
    (message as ChatUpdateArguments).ts = ts;
    return message as ChatUpdateArguments;
  }
  return message as ChatPostMessageArguments;
}

function buildHeaderBlock(
  mergeRequest: GitlabMergeRequestDetails,
  projectId: number,
): SectionBlock {
  const isClosed = MERGE_REQUEST_CLOSE_STATES.includes(mergeRequest.state);
  const title = escapeText(mergeRequest.title);
  const formattedTitle = isClosed ? `~${title}~` : title;
  const status = !MERGE_REQUEST_OPEN_STATES.includes(mergeRequest.state)
    ? ` (${mergeRequest.state})`
    : '';

  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*<${mergeRequest.web_url}|${formattedTitle}${status}>*`,
    },
    accessory: {
      type: 'overflow',
      action_id: 'review-message-actions',
      options: [
        {
          text: { type: 'plain_text', text: 'Create a pipeline' },
          value: injectActionsParameters(
            'review-create-pipeline',
            projectId,
            mergeRequest.source_branch,
          ),
        },
        {
          text: { type: 'plain_text', text: 'Rebase source branch' },
          value: injectActionsParameters(
            'review-rebase-source-branch',
            projectId,
            mergeRequest.iid,
          ),
        },
        {
          text: { type: 'plain_text', text: 'Delete message' },
          value: 'review-delete-message',
        },
      ],
    },
  };
}

function buildContextBlock(
  mergeRequest: GitlabMergeRequestDetails,
  project: GitlabProjectDetails,
): ContextBlock {
  const getPipelineStatus = (status?: GitlabPipelineStatus) => {
    const emojiMap: Record<string, string> = {
      success: '✅',
      manual: '⚙️',
      failed: '❌',
      running: '⏳',
      pending: '⏳',
      canceled: '🛑',
      skipped: '⏩',
    };
    return status ? `${emojiMap[status] || ''} ${status}` : 'None';
  };

  const getMergeableStatus = (mergeStatus: string) =>
    mergeStatus === 'can_be_merged' ? '✅ Yes' : '⚠️ No';

  return {
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Project: _<${project.web_url}|${project.path_with_namespace}>_`,
      },
      {
        type: 'mrkdwn',
        text: `Target branch: \`${mergeRequest.target_branch}\``,
      },
      {
        type: 'mrkdwn',
        text: `Open discussion(s): \`${mergeRequest.user_notes_count || 0}\``,
      },
      {
        type: 'mrkdwn',
        text: `Changes: \`${(mergeRequest as GitlabMergeRequestDetails).changes_count}\``,
      },
      {
        type: 'mrkdwn',
        text: `Pipeline: ${getPipelineStatus(mergeRequest.head_pipeline?.status)}`,
      },
      {
        type: 'mrkdwn',
        text: `Mergeable: ${getMergeableStatus(mergeRequest.merge_status)}`,
      },
    ],
  };
}

function buildPeopleSection(
  slackAssignees: SlackUser[],
  slackReviewers: SlackUser[],
  approvalInfo: ApprovalInfo,
): SectionBlock | null {
  const formatUsers = (users: SlackUser[]) =>
    users.map(({ name }) => `@${name}`);

  const fields: MrkdwnElement[] = [];
  const approvers = formatUsers(approvalInfo.approvers);
  const assignees = formatUsers(slackAssignees);
  const reviewers = formatUsers(slackReviewers);

  const participants = [...new Set([...assignees, ...reviewers])].filter(
    (user) => !approvers.includes(user),
  );

  if (participants.length > 0) {
    fields.push({
      type: 'mrkdwn',
      text: `*Participants*\n ${participants.sort().join(' ')}`,
    });
  }

  const approvedCount = Math.min(
    approvers.length,
    approvalInfo.approvals_required,
  );
  const remainingCount = Math.max(
    0,
    approvalInfo.approvals_required - approvedCount,
  );

  const approvedEmojis = Array(approvedCount).fill('✅').join('');
  const remainingEmojis = Array(remainingCount).fill('⬜️').join('');
  const emojiIndicators = approvedEmojis + remainingEmojis;

  fields.push({
    type: 'mrkdwn',
    text: `*Approvals*\n ${approvers.length}/${approvalInfo.approvals_required} required ${emojiIndicators}`,
  });

  if (approvers.length > 0) {
    fields.push({
      type: 'mrkdwn',
      text: `*Approved by*\n ${approvers.sort().join(' ')}`,
    });
  }

  if (fields.length === 0) return null;

  return { type: 'section', fields };
}

interface ApprovalInfo {
  approvers: SlackUser[];
  approvals_required: number;
}
