import type {
  ChatPostMessageArguments,
  ChatUpdateArguments,
  KnownBlock,
  MrkdwnElement,
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
import { type SlackUser } from '@/core/typings/SlackUser';
import { injectActionsParameters } from '@/core/utils/slackActions';

const SPARTACUX_PROJECT_PATH = 'spartacux';

export function buildReviewMessage(
  channelId: string,
  projectId: number,
  mergeRequestIid: number
): Promise<ChatPostMessageArguments>;

export function buildReviewMessage(
  channelId: string,
  projectId: number,
  mergeRequestIid: number,
  ts: string
): Promise<ChatUpdateArguments>;

export async function buildReviewMessage(
  channelId: string,
  projectId: number,
  mergeRequestIid: number,
  ts?: string
) {
  const mergeRequest = await fetchMergeRequestByIid(projectId, mergeRequestIid);
  const [
    rawAssignees,
    rawApprovers,
    mergeRequestAuthor,
    rawReviewers,
    project,
  ] = await Promise.all([
    fetchSlackUsersFromGitlabUsers(mergeRequest.assignees),
    fetchMergeRequestApprovers(projectId, mergeRequestIid).then(
      fetchSlackUsersFromGitlabUsers
    ),
    fetchSlackUserFromGitlabUser(mergeRequest.author),
    fetchReviewers(projectId, mergeRequestIid).then(
      fetchSlackUsersFromGitlabUsers
    ),
    fetchProjectById(projectId),
  ]);

  const formatUsers = (users: SlackUser[]) =>
    users.map(({ name }) => `@${name}`);

  const fields: MrkdwnElement[] = [];
  const approvers = formatUsers(rawApprovers);
  const assignees = formatUsers(rawAssignees);
  const reviewers = formatUsers(rawReviewers);

  const participants = [...new Set([...assignees, ...reviewers])].filter(
    (user) => !approvers.includes(user)
  );

  if (participants.length > 0) {
    fields.push({
      type: 'mrkdwn',
      text: `*Participants*\n ${participants.sort().join(' ')}`,
    });
  }

  if (approvers.length > 0) {
    fields.push({
      type: 'mrkdwn',
      text: `*Approved by*\n ${approvers.sort().join(' ')}`,
    });
  }

  const mergeRequestTitle = MERGE_REQUEST_CLOSE_STATES.includes(
    mergeRequest.state
  )
    ? `~${escapeText(mergeRequest.title)}~`
    : escapeText(mergeRequest.title);

  const mergeRequestStatus = MERGE_REQUEST_OPEN_STATES.includes(
    mergeRequest.state
  )
    ? ''
    : ` (${mergeRequest.state})`;

  const titleContextElements = [
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
      text: `Changes: \`${
        (mergeRequest as GitlabMergeRequestDetails).changes_count
      }\``,
    },
  ];

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*<${mergeRequest.web_url}|${mergeRequestTitle}${mergeRequestStatus}>*`,
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
              mergeRequest.source_branch
            ),
          },
          project.path === SPARTACUX_PROJECT_PATH && {
            text: {
              type: 'plain_text',
              text: '↳ and deploy FR B2C',
            },
            value: injectActionsParameters(
              'review-create-pipeline',
              projectId,
              mergeRequest.source_branch,
              'fr-b2c'
            ),
          },
          project.path === SPARTACUX_PROJECT_PATH && {
            text: {
              type: 'plain_text',
              text: '↳ and deploy FR B2B',
            },
            value: injectActionsParameters(
              'review-create-pipeline',
              projectId,
              mergeRequest.source_branch,
              'fr-b2b'
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
              mergeRequest.iid
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

  if (fields.length > 0) {
    blocks.push({
      type: 'section',
      fields,
    });
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
    message.ts = ts;
    return message as ChatUpdateArguments;
  }
  return message as ChatPostMessageArguments;
}
