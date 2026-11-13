import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import type { GitlabPushedCommit } from '@/core/typings/GitlabPushedCommit';
import { handlePushEvent } from '../events/handlePushEvent';

export async function pushHookHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { commits, project_id, ref } = req.body as {
    commits: GitlabPushedCommit[];
    project_id: number;
    ref: string;
  };

  await handlePushEvent(
    {
      provider: 'gitlab',
      projectId: project_id,
      branchName: ref.split('/').slice(2).join('/'),
      commits: commits.map((commit) => ({
        id: commit.id,
        title: commit.title,
        url: commit.url,
        authorEmail: commit.author.email,
        changesCount:
          (commit.added || []).length +
          (commit.modified || []).length +
          (commit.removed || []).length,
      })),
    },
    (handled) =>
      res.sendStatus(handled ? HTTP_STATUS_OK : HTTP_STATUS_NO_CONTENT),
  );
}
