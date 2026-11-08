import type { KnownBlock } from '@slack/types';
import { getReviewsByMergeRequestIid } from '@/core/services/data';
import { getProvider } from '@/core/services/providers/ProviderFactory';
import {
  fetchSlackUserFromEmails,
  slackBotWebClient,
} from '@/core/services/slack';
import type { DataReview } from '@/core/typings/Data';
import type { ProviderType } from '@/core/typings/Provider';
import { handleReviewWebhookError } from '../utils/handleReviewWebhookError';
import { waitForMergeRequestCommits } from '../utils/waitForMergeRequestCommits';

export interface PushedCommit {
  id: string;
  title: string;
  url: string;
  authorEmail: string;
  changesCount: number;
}

export interface PushEvent {
  provider: ProviderType;
  projectId: number;
  branchName: string;
  commits: PushedCommit[];
}

export async function handlePushEvent(
  { branchName, commits, projectId, provider }: PushEvent,
  acknowledge: (handled: boolean) => void,
): Promise<void> {
  // Happens when a merge request is merged 🧐
  if (commits.length === 0) {
    acknowledge(false);
    return;
  }

  const repositoryProvider = getProvider(provider);
  const mergeRequests = await repositoryProvider.fetchOpenPullRequestsByBranch(
    projectId,
    branchName,
  );

  const pushedCommitIds = new Set(commits.map(({ id }) => id));

  const mergeRequestsReviews = await Promise.all(
    mergeRequests.map(async (mergeRequest) => {
      const mergeRequestCommitIds = await waitForMergeRequestCommits(
        repositoryProvider,
        projectId,
        mergeRequest.iid,
        pushedCommitIds,
      );

      // Removes the rebase commits
      const newMergeRequestCommits = commits.filter((commit) =>
        mergeRequestCommitIds.includes(commit.id),
      );

      if (newMergeRequestCommits.length === 0) {
        return;
      }

      return (
        await getReviewsByMergeRequestIid(projectId, mergeRequest.iid, provider)
      ).map((review) => ({
        ...review,
        newMergeRequestCommits,
      }));
    }),
  );
  const reviews = mergeRequestsReviews.flat().filter(Boolean) as (DataReview & {
    newMergeRequestCommits: PushedCommit[];
  })[];

  if (reviews.length === 0) {
    acknowledge(false);
    return;
  }
  acknowledge(true);

  await Promise.all(
    reviews.map(
      async ({ channelId, mergeRequestIid, newMergeRequestCommits, ts }) => {
        try {
          await slackBotWebClient.chat.postMessage({
            text: ':git-commit: New commit(s)',
            icon_emoji: ':git-commit:',
            channel: channelId,
            thread_ts: ts,
            blocks: (
              await Promise.all(newMergeRequestCommits.map(buildCommitBlocks))
            ).flat(),
          });
        } catch (err) {
          await handleReviewWebhookError(err, {
            hook: 'push',
            mrIid: mergeRequestIid,
            projectId,
            channelId,
            reviewTs: ts,
          });
        }
      },
    ),
  );
}

async function buildCommitBlocks(commit: PushedCommit): Promise<KnownBlock[]> {
  const author = await fetchSlackUserFromEmails([commit.authorEmail]);

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<${commit.url}|${commit.title}>`,
      },
    },
    {
      type: 'context',
      elements: [
        ...(author !== undefined
          ? [
              {
                type: 'image' as const,
                image_url: author.profile.image_24,
                alt_text: author.real_name,
              },
              {
                type: 'mrkdwn' as const,
                text: `*${author.real_name}*`,
              },
            ]
          : []),
        {
          type: 'plain_text' as const,
          text: `${commit.changesCount} changes`,
        },
      ],
    },
  ];
}
