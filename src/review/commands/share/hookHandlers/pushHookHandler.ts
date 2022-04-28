import { MessageAttachment } from '@slack/web-api';
import { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { getReviewsByMergeRequestIid } from '@/core/services/data';
import {
  fetchMergeRequestCommits,
  fetchMergeRequestsByBranchName,
} from '@/core/services/gitlab';
import { fetchSlackUserFromEmail, slackWebClient } from '@/core/services/slack';
import { DataReview } from '@/core/typings/Data';
import { GitlabPushedCommit } from '@/core/typings/GitlabPushedCommit';

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

  const branchName = ref.split('/').pop() as string;

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
      slackWebClient.chat.postMessage({
        text: 'New commit',
        icon_emoji: ':point_up:',
        channel: channelId,
        thread_ts: ts,
        link_names: true,
        attachments: await Promise.all<MessageAttachment>(
          newMergeRequestCommits.map(async (commit: GitlabPushedCommit) => {
            const author = await fetchSlackUserFromEmail(commit.author.email);
            const attachment = {
              title: commit.title,
              title_link: commit.url,
              color: '#d4d4d4',
              footer: `${
                (commit.added || []).length +
                (commit.modified || []).length +
                (commit.removed || []).length
              } changes`,
            } as MessageAttachment;

            if (author !== undefined) {
              attachment.author_name = author.real_name;
              attachment.author_icon = author.profile.image_24;
            }
            return attachment;
          })
        ),
      })
    )
  );
}
