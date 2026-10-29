import type { ChatPostEphemeralArguments } from '@slack/web-api';
import slackifyMarkdown from 'slackify-markdown';
import { MERGE_REQUEST_OPEN_STATES } from '@/constants';
import {
  fetchMergeRequestByIid,
  fetchMergeRequestReviewers,
} from '@/core/services/gitlab';
import {
  fetchGitlabUsernameFromSlackUserId,
  getPermalink,
} from '@/core/services/slack';
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
  projectId: number;
}

interface ReviewListSection {
  items: ReviewListItem[];
  title: string;
}

export async function buildReviewListEphemeral({
  channelId,
  reviews,
  userId,
}: BuildReviewListEphemeralData): Promise<ChatPostEphemeralArguments> {
  const [items, gitlabUsername] = await Promise.all([
    fetchOpenedReviewItems(channelId, reviews),
    fetchGitlabUsernameFromSlackUserId(userId),
  ]);

  const sections =
    gitlabUsername === undefined
      ? [{ title: 'Ongoing reviews', items }]
      : await buildPersonalizedSections(items, gitlabUsername);

  const nonEmptySections = sections
    .filter((section) => section.items.length > 0)
    .map((section) => ({
      ...section,
      items: [...section.items].sort((a, b) =>
        formatItem(a).localeCompare(formatItem(b)),
      ),
    }));

  const formattedReviews = nonEmptySections
    .map(
      ({ title, items: sectionItems }) =>
        `**${title}:**\n${sectionItems.map(formatItem).join('\n')}`,
    )
    .join('\n\n');

  const formattedReviewsFallback = nonEmptySections
    .flatMap((section) => section.items)
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
              ? slackifyMarkdown(formattedReviews)
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
      return {
        link: await getPermalink(channelId, ts),
        mergeRequest,
        projectId,
      };
    }),
  );

  return items.filter((item): item is ReviewListItem => item !== undefined);
}

/**
 * Splits reviews into:
 *  - those the user is a reviewer of and has not reviewed yet,
 *  - those the user authored,
 *  - the others.
 */
async function buildPersonalizedSections(
  items: ReviewListItem[],
  gitlabUsername: string,
): Promise<ReviewListSection[]> {
  const waitingForReview: ReviewListItem[] = [];
  const authored: ReviewListItem[] = [];
  const others: ReviewListItem[] = [];

  await Promise.all(
    items.map(async (item) => {
      const { author, iid } = item.mergeRequest;

      if (author.username === gitlabUsername) {
        authored.push(item);
        return;
      }

      const reviewers = await fetchMergeRequestReviewers(item.projectId, iid);
      const isWaitingForReview = reviewers.some(
        ({ state, user }) =>
          user.username === gitlabUsername && state === 'unreviewed',
      );

      (isWaitingForReview ? waitingForReview : others).push(item);
    }),
  );

  return [
    { title: 'Waiting for your review', items: waitingForReview },
    { title: 'Your merge requests', items: authored },
    { title: 'Other reviews', items: others },
  ];
}

function formatItem({ link, mergeRequest }: ReviewListItem): string {
  return `- [${mergeRequest.title}](${link})`;
}
