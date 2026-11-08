import type { SectionBlock } from '@slack/types';
import type { ChatPostEphemeralArguments } from '@slack/web-api';
import { MERGE_REQUEST_OPEN_STATES } from '@/constants';
import { getProvider } from '@/core/services/providers/ProviderFactory';
import { escapeText, getPermalink } from '@/core/services/slack';
import type { DataReview } from '@/core/typings/Data';
import type { ProviderType } from '@/core/typings/Provider';
import type { UnifiedPullRequest } from '@/core/typings/UnifiedModels';

// Slack refuses a longer section text with invalid_blocks.
const SECTION_TEXT_MAX_LENGTH = 3000;

interface BuildReviewListEphemeralData {
  channelId: string;
  reviews: DataReview[];
  userId: string;
}

interface ReviewListItem {
  link: string;
  mergeRequest: UnifiedPullRequest;
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
  const items = await fetchOpenedReviewItems(channelId, reviews);
  const usernames = await findGitUsernames(
    userId,
    new Set(items.map(({ mergeRequest }) => mergeRequest.provider)),
  );

  const sections =
    usernames.size === 0
      ? [{ title: 'Ongoing reviews', items }]
      : await buildPersonalizedSections(items, usernames);

  const nonEmptySections = sections
    .filter((section) => section.items.length > 0)
    .map((section) => ({
      ...section,
      items: [...section.items].sort((a, b) =>
        a.mergeRequest.title.localeCompare(b.mergeRequest.title),
      ),
    }));

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
    blocks:
      items.length > 0
        ? nonEmptySections.flatMap(({ title, items: sectionItems }) =>
            buildSectionBlocks([
              `*${title}:*`,
              ...sectionItems.map(formatItem),
            ]),
          )
        : buildSectionBlocks([
            'There is no ongoing review shared in this channel :homer-metal:',
          ]),
  };
}

async function fetchOpenedReviewItems(
  channelId: string,
  reviews: DataReview[],
): Promise<ReviewListItem[]> {
  const items = await Promise.all(
    reviews.map(async ({ projectId, provider, mergeRequestIid, ts }) => {
      const mergeRequest = await getProvider(provider).fetchPullRequest(
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

/** Git username of the Slack user on each provider of the listed reviews. */
async function findGitUsernames(
  slackUserId: string,
  providers: Set<ProviderType>,
): Promise<Map<ProviderType, string>> {
  const usernames = new Map<ProviderType, string>();

  await Promise.all(
    [...providers].map(async (provider) => {
      const username = await getProvider(provider).findGitUsername(slackUserId);
      if (username !== undefined) {
        usernames.set(provider, username);
      }
    }),
  );
  return usernames;
}

/**
 * Splits reviews into:
 *  - those the user is a reviewer of and has not reviewed yet,
 *  - those the user authored,
 *  - the others.
 */
async function buildPersonalizedSections(
  items: ReviewListItem[],
  usernames: Map<ProviderType, string>,
): Promise<ReviewListSection[]> {
  const waitingForReview: ReviewListItem[] = [];
  const authored: ReviewListItem[] = [];
  const others: ReviewListItem[] = [];

  await Promise.all(
    items.map(async (item) => {
      const { projectId } = item;
      const { author, iid, provider } = item.mergeRequest;
      const username = usernames.get(provider);

      if (username !== undefined && isSameUser(author.username, username)) {
        authored.push(item);
        return;
      }

      const isWaitingForReview =
        username !== undefined &&
        (
          await getProvider(provider).fetchPendingReviewerUsernames(
            projectId,
            iid,
          )
        ).some((reviewer) => isSameUser(reviewer, username));

      (isWaitingForReview ? waitingForReview : others).push(item);
    }),
  );

  return [
    { title: 'Waiting for your review', items: waitingForReview },
    { title: 'Your merge requests', items: authored },
    { title: 'Other reviews', items: others },
  ];
}

// GitHub logins are case insensitive.
function isSameUser(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function formatItem({ link, mergeRequest }: ReviewListItem): string {
  return `• <${link}|${escapeText(mergeRequest.title)}>`;
}

/** Spreads the lines over as few sections as Slack accepts. */
function buildSectionBlocks(lines: string[]): SectionBlock[] {
  const texts: string[] = [];

  for (const line of lines) {
    const last = texts.length - 1;

    if (
      last >= 0 &&
      texts[last].length + 1 + line.length <= SECTION_TEXT_MAX_LENGTH
    ) {
      texts[last] += `\n${line}`;
    } else {
      texts.push(line);
    }
  }
  return texts.map((text) => ({
    type: 'section',
    text: { type: 'mrkdwn', text },
  }));
}
