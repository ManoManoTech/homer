import type { KnownBlock } from '@slack/types';
import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { getReviewsByMergeRequestIid } from '@/core/services/data';
import {
  fetchMergeRequestCommits,
  fetchMergeRequestsByBranchName,
} from '@/core/services/gitlab';
import {
  fetchSlackUserFromEmail,
  slackBotWebClient,
} from '@/core/services/slack';
import type { DataReview } from '@/core/typings/Data';
import type { GitlabPushedCommit } from '@/core/typings/GitlabPushedCommit';

export async function pushHookHandler(
  req: Request,
  res: Response
): Promise<void> {
  const { commits, project_id, ref } = req.body as {
    commits: GitlabPushedCommit[];
    project_id: number;
    ref: string;
  };

  // Happens when a merge request is merged 🧐
  if (commits.length === 0) {
    res.sendStatus(HTTP_STATUS_NO_CONTENT);
    return;
  }

  const branchName = ref.split('/').slice(2).join('/') as string;

  const mergeRequests =
    (await fetchMergeRequestsByBranchName(project_id, branchName)).filter(
      ({ merge_status }) => merge_status !== 'merged'
    ) || [];

  const mergeRequestsReviews = await Promise.all(
    mergeRequests.map(async (mergeRequest) => {
      const mergeRequestCommits = await fetchMergeRequestCommits(
        project_id,
        mergeRequest.iid
      );

      // Removes the rebase commits
      const newMergeRequestCommits = commits.filter((commit) =>
        mergeRequestCommits.some(
          (mergeRequestCommit) => mergeRequestCommit.id === commit.id
        )
      );

      if (newMergeRequestCommits.length === 0) {
        return;
      }

      return (
        await getReviewsByMergeRequestIid(project_id, mergeRequest.iid)
      ).map((review) => ({
        ...review,
        newMergeRequestCommits,
      }));
    })
  );
  const reviews = mergeRequestsReviews.flat().filter(Boolean) as (DataReview & {
    newMergeRequestCommits: GitlabPushedCommit[];
  })[];

  if (reviews.length === 0) {
    res.sendStatus(HTTP_STATUS_NO_CONTENT);
    return;
  }
  res.sendStatus(HTTP_STATUS_OK);

  await Promise.all(
    reviews.map(async ({ channelId, newMergeRequestCommits, ts }) =>
      slackBotWebClient.chat.postMessage({
        text: ':git-commit: New commit(s)',
        icon_emoji: ':git-commit:',
        channel: channelId,
        thread_ts: ts,
        blocks: (
          await Promise.all<KnownBlock[]>(
            newMergeRequestCommits.map(
              async (commit: GitlabPushedCommit): Promise<KnownBlock[]> => {
                const author = await fetchSlackUserFromEmail(
                  commit.author.email
                );
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
                        text: `${
                          (commit.added || []).length +
                          (commit.modified || []).length +
                          (commit.removed || []).length
                        } changes`,
                      },
                    ],
                  },
                ];
              }
            )
          )
        ).flat(),
      })
    )
  );
}
