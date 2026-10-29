import type { ChatPostEphemeralArguments } from '@slack/web-api';
import slackifyMarkdown from 'slackify-markdown';
import { MERGE_REQUEST_OPEN_STATES } from '@/constants';
import { fetchMergeRequestByIid } from '@/core/services/gitlab';
import { getPermalink } from '@/core/services/slack';
import type { DataReview } from '@/core/typings/Data';
import type { GitlabMergeRequestDetails } from '@/core/typings/GitlabMergeRequest';

interface BuildReviewListEphemeralData {
  channelId: string;
  reviews: DataReview[];
  userId: string;
}

interface ReviewListItem {
  link: string;
  mergeRequest: GitlabMergeRequestDetails;
}

export async function buildReviewListEphemeral({
  channelId,
  reviews,
  userId,
}: BuildReviewListEphemeralData): Promise<ChatPostEphemeralArguments> {
  const items = await fetchOpenedReviewItems(channelId, reviews);

  const formattedReviews = items
    .map(({ link, mergeRequest }) => `- [${mergeRequest.title}](${link})`)
    .sort()
    .join('\n');

  const formattedReviewsFallback = items
    .map(({ mergeRequest }) => mergeRequest.title)
    .join(', ');

  return {
    channel: channelId,
    user: userId,
    text:
      items.length > 0
        ? `Ongoing reviews: ${formattedReviewsFallback}.`
        : 'There is no ongoing review shared in this channel.',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            items.length > 0
              ? slackifyMarkdown(`**Ongoing reviews:**\n${formattedReviews}`)
              : 'There is no ongoing review shared in this channel :homer-metal:',
        },
      },
    ],
  };
}

async function fetchOpenedReviewItems(
  channelId: string,
  reviews: DataReview[],
): Promise<ReviewListItem[]> {
  const items = await Promise.all(
    reviews.map(async ({ projectId, mergeRequestIid, ts }) => {
      const mergeRequest = await fetchMergeRequestByIid(
        projectId,
        mergeRequestIid,
      );

      if (!MERGE_REQUEST_OPEN_STATES.includes(mergeRequest.state)) {
        return undefined;
      }
      return { link: await getPermalink(channelId, ts), mergeRequest };
    }),
  );

  return items.filter((item): item is ReviewListItem => item !== undefined);
}
