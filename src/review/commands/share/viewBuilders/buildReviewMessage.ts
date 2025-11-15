import type {
  ChatPostMessageArguments,
  ChatUpdateArguments,
  KnownBlock,
  MrkdwnElement,
  SectionBlock,
} from '@slack/web-api';
import {
  MERGE_REQUEST_CLOSE_STATES,
  MERGE_REQUEST_OPEN_STATES,
} from '@/constants';
import { ProviderFactory } from '@/core/services/providers/ProviderFactory';
import {
  escapeText,
  fetchSlackUserFromGitlabUser,
  fetchSlackUsersFromGitlabUsers,
} from '@/core/services/slack';
import { type SlackUser } from '@/core/typings/SlackUser';
import type { UnifiedUser } from '@/core/typings/UnifiedModels';
import { injectActionsParameters } from '@/core/utils/slackActions';

export function buildReviewMessage(
  channelId: string,
  projectId: number | string,
  mergeRequestIid: number,
): Promise<ChatPostMessageArguments>;

export function buildReviewMessage(
  channelId: string,
  projectId: number | string,
  mergeRequestIid: number,
  ts: string,
): Promise<ChatUpdateArguments>;

export async function buildReviewMessage(
  channelId: string,
  projectId: number | string,
  mergeRequestIid: number,
  ts?: string,
) {
  // Get the appropriate provider for this project
  const provider = ProviderFactory.getProviderForProject(projectId);

  // Fetch pull request and related data using the provider
  const pullRequest = await provider.fetchPullRequest(
    projectId,
    mergeRequestIid,
  );

  // Helper to transform UnifiedUser to format expected by Slack functions
  const transformToGitlabUser = (user: UnifiedUser) => ({
    id: typeof user.id === 'number' ? user.id : 0,
    username: user.username,
    name: user.name,
    avatar_url: user.avatarUrl || null,
    state: 'active' as const,
    web_url: user.webUrl || '',
  });

  const [
    slackAssignees,
    approvalInfo,
    mergeRequestAuthor,
    slackReviewers,
    project,
  ] = await Promise.all([
    provider
      .fetchAssignees(projectId, mergeRequestIid)
      .then((users) => users.map(transformToGitlabUser))
      .then(fetchSlackUsersFromGitlabUsers),
    provider
      .fetchApprovalInfo(projectId, mergeRequestIid)
      .then(async (info) => ({
        approvers: await fetchSlackUsersFromGitlabUsers(
          info.approvers.map(transformToGitlabUser),
        ),
        approvalsRequired: info.approvalsRequired,
        approvalsLeft: info.approvalsLeft,
      })),
    fetchSlackUserFromGitlabUser(transformToGitlabUser(pullRequest.author)),
    provider
      .fetchReviewers(projectId, mergeRequestIid)
      .then((users) => users.map(transformToGitlabUser))
      .then(fetchSlackUsersFromGitlabUsers),
    provider.fetchProject(projectId),
  ]);

  const mergeRequestTitle = MERGE_REQUEST_CLOSE_STATES.includes(
    pullRequest.state,
  )
    ? `~${escapeText(pullRequest.title)}~`
    : escapeText(pullRequest.title);

  const mergeRequestStatus = MERGE_REQUEST_OPEN_STATES.includes(
    pullRequest.state,
  )
    ? ''
    : ` (${pullRequest.state})`;

  // Add provider emoji
  const providerType = ProviderFactory.detectProviderType(projectId);
  const providerEmoji = providerType === 'github' ? ':github:' : ':gitlab:';

  const titleContextElements = [
    {
      type: 'mrkdwn',
      text: `${providerEmoji} Project: _<${project.webUrl}|${project.pathWithNamespace}>_`,
    },
    {
      type: 'mrkdwn',
      text: `Target branch: \`${pullRequest.targetBranch}\``,
    },
    {
      type: 'mrkdwn',
      text: `Open discussion(s): \`${pullRequest.discussionCount || 0}\``,
    },
    {
      type: 'mrkdwn',
      text: `Changes: \`${pullRequest.changesCount}\``,
    },
  ];

  // Add pipeline status if available
  if (pullRequest.pipeline) {
    const pipelineEmoji =
      pullRequest.pipeline.status === 'success'
        ? '✅'
        : pullRequest.pipeline.status === 'failed'
          ? '❌'
          : pullRequest.pipeline.status === 'running'
            ? '🔄'
            : pullRequest.pipeline.status === 'canceled'
              ? '⛔'
              : '⏳';
    titleContextElements.push({
      type: 'mrkdwn',
      text: `Pipeline: ${pipelineEmoji} ${pullRequest.pipeline.status}`,
    });
  }

  // Add mergeable status
  const mergeableEmoji = pullRequest.mergeable ? '✅' : '❌';
  const mergeableText = pullRequest.mergeable ? 'Yes' : 'No';
  titleContextElements.push({
    type: 'mrkdwn',
    text: `Mergeable: ${mergeableEmoji} ${mergeableText}`,
  });

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*<${pullRequest.webUrl}|${mergeRequestTitle}${mergeRequestStatus}>*`,
      },
      accessory: {
        type: 'overflow',
        action_id: 'review-message-actions',
        options: [
          {
            text: {
              type: 'plain_text',
              text: 'Create a pipeline',
            },
            value: injectActionsParameters(
              'review-create-pipeline',
              projectId,
              pullRequest.sourceBranch,
            ),
          },
          {
            text: {
              type: 'plain_text',
              text: 'Rebase source branch',
            },
            value: injectActionsParameters(
              'review-rebase-source-branch',
              projectId,
              pullRequest.iid,
            ),
          },
          {
            text: {
              type: 'plain_text',
              text: 'Delete message',
            },
            value: 'review-delete-message',
          },
        ].filter(Boolean),
      },
    },
    {
      type: 'context',
      elements: titleContextElements,
    },
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
    text: `${mergeRequestTitle} ${pullRequest.webUrl}${mergeRequestStatus}`,
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

  const approvedCount =
    approvalInfo.approvalsRequired - approvalInfo.approvalsLeft;
  const emojiIndicators = approvalInfo.approvalsLeft == 0 ? '✅' : '⏳';

  fields.push({
    type: 'mrkdwn',
    text: `*Approvals*\n ${approvedCount}/${approvalInfo.approvalsRequired} required ${emojiIndicators}`,
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
  approvalsRequired: number;
  approvalsLeft: number;
}
