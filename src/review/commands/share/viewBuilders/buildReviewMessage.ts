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
import { getProvider } from '@/core/services/providers/ProviderFactory';
import { escapeText } from '@/core/services/slack';
import { fetchSlackUsers, findSlackUser } from '@/core/services/slackUsers';
import type { ProviderType } from '@/core/typings/Provider';
import { type SlackUser } from '@/core/typings/SlackUser';
import type {
  UnifiedProject,
  UnifiedPullRequest,
} from '@/core/typings/UnifiedModels';
import { formatProjectRef } from '@/core/utils/projectRef';
import { injectActionsParameters } from '@/core/utils/slackActions';

export function buildReviewMessage(
  channelId: string,
  provider: ProviderType,
  projectId: number,
  mergeRequestIid: number,
): Promise<ChatPostMessageArguments>;

export function buildReviewMessage(
  channelId: string,
  provider: ProviderType,
  projectId: number,
  mergeRequestIid: number,
  ts: string,
): Promise<ChatUpdateArguments>;

export async function buildReviewMessage(
  channelId: string,
  providerType: ProviderType,
  projectId: number,
  mergeRequestIid: number,
  ts?: string,
) {
  const provider = getProvider(providerType);
  const mergeRequest = await provider.fetchPullRequest(
    projectId,
    mergeRequestIid,
  );
  const [
    slackAssignees,
    approvalInfo,
    mergeRequestAuthor,
    slackReviewers,
    project,
  ] = await Promise.all([
    fetchSlackUsers(providerType, mergeRequest.assignees),
    provider
      .fetchApprovalInfo(projectId, mergeRequestIid)
      .then(async (info) => ({
        approvers: await fetchSlackUsers(providerType, info.approvers),
        approvals_required: info.approvalsRequired,
        approvals_left: info.approvalsLeft,
      })),
    findSlackUser(providerType, mergeRequest.author),
    provider
      .fetchReviewers(projectId, mergeRequestIid)
      .then((reviewers) => fetchSlackUsers(providerType, reviewers)),
    provider.fetchProject(projectId),
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
    buildHeaderBlock(mergeRequest, providerType, projectId),
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
    text: `${mergeRequestTitle} ${mergeRequest.webUrl}${mergeRequestStatus}`,
    blocks,
    // The title already links to the merge request; previews of it and of
    // the repository are noise.
    unfurl_links: false,
    unfurl_media: false,
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
  mergeRequest: UnifiedPullRequest,
  provider: ProviderType,
  projectId: number,
): SectionBlock {
  const projectRef = formatProjectRef({ provider, projectId });
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
      text: `*<${mergeRequest.webUrl}|${formattedTitle}${status}>*`,
    },
    accessory: {
      type: 'overflow',
      action_id: 'review-message-actions',
      options: [
        {
          text: { type: 'plain_text', text: 'Create a pipeline' },
          value: injectActionsParameters(
            'review-create-pipeline',
            projectRef,
            mergeRequest.sourceBranch,
          ),
        },
        {
          text: { type: 'plain_text', text: 'Rebase source branch' },
          value: injectActionsParameters(
            'review-rebase-source-branch',
            projectRef,
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
  mergeRequest: UnifiedPullRequest,
  project: UnifiedProject,
): ContextBlock {
  const getPipelineStatus = (status?: string) => {
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

  const getMergeableStatus = (mergeable: boolean | undefined) => {
    if (mergeable === undefined) {
      return '⏳ Checking';
    }
    return mergeable ? '✅ Yes' : '⚠️ No';
  };

  return {
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Project: :${project.provider}: _<${project.webUrl}|${project.path}>_`,
      },
      {
        type: 'mrkdwn',
        text: `Target branch: \`${mergeRequest.targetBranch}\``,
      },
      {
        type: 'mrkdwn',
        text: `Open discussion(s): \`${mergeRequest.discussionsCount}\``,
      },
      {
        type: 'mrkdwn',
        text: `Changes: \`${mergeRequest.changesCount}\``,
      },
      {
        type: 'mrkdwn',
        text: `Pipeline: ${getPipelineStatus(mergeRequest.pipelineStatus)}`,
      },
      {
        type: 'mrkdwn',
        text: `Mergeable: ${getMergeableStatus(mergeRequest.mergeable)}`,
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

  const { approvals_left: approvalsLeft, approvals_required: required } =
    approvalInfo;

  // Hidden when unknown: a guessed count would be a wrong number.
  if (
    required !== undefined &&
    approvalsLeft !== undefined &&
    Number.isFinite(required) &&
    Number.isFinite(approvalsLeft)
  ) {
    const approvedCount = required - approvalsLeft;
    const emojiIndicators = approvalsLeft == 0 ? '✅' : '⏳';

    fields.push({
      type: 'mrkdwn',
      text: `*Approvals*\n ${approvedCount}/${required} required ${emojiIndicators}`,
    });
  }

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
  approvals_required?: number;
  approvals_left?: number;
}
