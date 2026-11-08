import { CONFIG } from '@/config';
import {
  addReviewToChannel,
  getChannelsByProjectId,
  getReviewsByMergeRequestIid,
  removeReviewsByMergeRequestIid,
} from '@/core/services/data';
import { logger } from '@/core/services/logger';
import { getProvider } from '@/core/services/providers/ProviderFactory';
import { slackBotWebClient } from '@/core/services/slack';
import type { ProviderType } from '@/core/typings/Provider';
import type { UnifiedUser } from '@/core/typings/UnifiedModels';
import { handleReviewWebhookError } from '../utils/handleReviewWebhookError';
import { buildReviewMessage } from '../viewBuilders/buildReviewMessage';

export type PullRequestAction =
  | 'approval'
  | 'approved'
  | 'close'
  | 'merge'
  | 'open'
  | 'reopen'
  | 'unapproval'
  | 'unapproved'
  | 'update';

export const REVIEW_LABELS = {
  REVIEW: 'homer-review',
  MERGEABLE: 'homer-mergeable',
} as const;

export interface PullRequestEvent {
  provider: ProviderType;
  projectId: number;
  iid: number;
  action: PullRequestAction;
  labels: string[];
  /** Whether the pull request can be merged once approved. */
  isMergeable: boolean;
  /** User who triggered the event. */
  actor: UnifiedUser;
}

interface ThreadMessage {
  text: string;
  icon_emoji: string;
}

/**
 * `acknowledge` is called as soon as Homer knows whether the event is relevant,
 * so the webhook can be answered before the Slack calls.
 */
export async function handlePullRequestEvent(
  event: PullRequestEvent,
  acknowledge: (handled: boolean) => void,
): Promise<void> {
  const { action, actor, iid, labels, projectId, provider } = event;
  const reviews = await getReviewsByMergeRequestIid(projectId, iid, provider);

  if (reviews.length === 0) {
    const hasReviewLabel = labels.includes(REVIEW_LABELS.REVIEW);
    const isMergeable =
      labels.includes(REVIEW_LABELS.MERGEABLE) && event.isMergeable;

    if (hasReviewLabel || isMergeable) {
      await handleNewReview(provider, projectId, iid);
      acknowledge(true);
      return;
    }
    acknowledge(false);
    return;
  }

  const user = await getProvider(provider).findSlackUser(actor);
  if (!user) {
    acknowledge(false);
    return;
  }

  acknowledge(true);

  const threadMessage = getThreadMessage(action, user.real_name);

  await Promise.all(
    reviews.map(async ({ channelId, ts }) => {
      try {
        await Promise.all(
          [
            buildReviewMessage(channelId, provider, projectId, iid, ts).then(
              slackBotWebClient.chat.update,
            ),
            threadMessage &&
              slackBotWebClient.chat.postMessage({
                channel: channelId,
                thread_ts: ts,
                ...threadMessage,
              }),
          ].filter(Boolean),
        );
      } catch (err) {
        await handleReviewWebhookError(err, {
          hook: 'merge_request',
          mrIid: iid,
          projectId,
          channelId,
          reviewTs: ts,
        });
      }
    }),
  );

  if (['close', 'merge'].includes(action)) {
    await removeReviewsByMergeRequestIid(projectId, iid, provider);
  }
}

async function handleNewReview(
  provider: ProviderType,
  projectId: number,
  iid: number,
): Promise<void> {
  const configuredChannels = await getChannelsByProjectId(projectId, provider);

  if (configuredChannels.length === 0) {
    return;
  }

  if (configuredChannels.length > CONFIG.slack.channelNotificationThreshold) {
    logger.warn(`Too many channels linked to project ${projectId}`);
    return;
  }

  await Promise.all(
    configuredChannels.map(async ({ channelId }) => {
      try {
        const { ts } = await slackBotWebClient.chat.postMessage(
          await buildReviewMessage(channelId, provider, projectId, iid),
        );
        await addReviewToChannel({
          channelId,
          mergeRequestIid: iid,
          projectId,
          provider,
          ts: ts as string,
        });
      } catch (err) {
        await handleReviewWebhookError(err, {
          hook: 'merge_request',
          mrIid: iid,
          projectId,
          channelId,
        });
      }
    }),
  );
}

function getThreadMessage(
  action: PullRequestAction,
  userName: string,
): ThreadMessage | undefined {
  const approved = {
    text: `*${userName}* has approved this merge request.`,
    icon_emoji: ':thumbsup_blue:',
  };
  const unapproved = {
    text: `*${userName}* has unapproved this merge request.`,
    icon_emoji: ':thumbsdown_blue:',
  };
  // GitLab sends approved and unapproved only when the required approvals are
  // reached or lost, approval and unapproval for each user.
  const messages: Partial<Record<PullRequestAction, ThreadMessage>> = {
    approval: approved,
    approved,
    close: {
      text: `*${userName}* has closed this merge request.`,
      icon_emoji: ':closed_book_blue:',
    },
    merge: {
      text: `*${userName}* has merged this merge request.`,
      icon_emoji: ':git-merge:',
    },
    unapproval: unapproved,
    unapproved,
  };
  return messages[action];
}
