import type {
  ChatPostEphemeralArguments,
  ChatPostMessageArguments,
} from '@slack/web-api';
import slackifyMarkdown from 'slackify-markdown';
import { MERGE_REQUEST_OPEN_STATES } from '@/constants';
import { fetchMergeRequestByIid } from '@/core/services/gitlab';
import { getPermalink } from '@/core/services/slack';
import type { DataReview } from '@/core/typings/Data';

interface BuildReviewListEphemeralData {
  channelId: string;
  reviews: DataReview[];
  userId: string;
}

/**
 * Builds the list of the reviews shared in a channel whose merge request is
 * still open, each one linking to its review message.
 *
 * Fetches every merge request from Gitlab, then the permalink of each open one
 * from Slack.
 *
 * @returns `undefined` when none of the reviews has an open merge request.
 */
export async function buildReviewListMessage(
  channelId: string,
  reviews: DataReview[],
): Promise<ChatPostMessageArguments | undefined> {
  const mergeRequests = await Promise.all(
    reviews.map(({ projectId, mergeRequestIid }) =>
      fetchMergeRequestByIid(projectId, mergeRequestIid),
    ),
  );

  const openedMergeRequests = mergeRequests.filter(({ state }) =>
    MERGE_REQUEST_OPEN_STATES.includes(state),
  );

  if (openedMergeRequests.length === 0) {
    return undefined;
  }

  const links = new Map<number, string>();

  await Promise.all(
    reviews
      .filter(({ mergeRequestIid }) =>
        openedMergeRequests.some(({ iid }) => iid === mergeRequestIid),
      )
      .map(async ({ mergeRequestIid, ts }) => {
        links.set(mergeRequestIid, await getPermalink(channelId, ts));
      }),
  );

  const formattedReviews = openedMergeRequests
    .map(({ iid, title }) => `- [${title}](${links.get(iid)})`)
    .sort()
    .join('\n');

  const formattedReviewsFallback = openedMergeRequests
    .map(({ title }) => title)
    .join(', ');

  return {
    channel: channelId,
    text: `Ongoing reviews: ${formattedReviewsFallback}.`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: slackifyMarkdown(`**Ongoing reviews:**\n${formattedReviews}`),
        },
      },
    ],
  };
}

export async function buildReviewListEphemeral({
  channelId,
  reviews,
  userId,
}: BuildReviewListEphemeralData): Promise<ChatPostEphemeralArguments> {
  const message = await buildReviewListMessage(channelId, reviews);

  if (message !== undefined) {
    return { ...message, user: userId };
  }

  return {
    channel: channelId,
    user: userId,
    text: 'There is no ongoing review shared in this channel.',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'There is no ongoing review shared in this channel :homer-metal:',
        },
      },
    ],
  };
}
