import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { toUnifiedUser } from '@/core/services/providers/GitLabProvider';
import type { GitlabUser } from '@/core/typings/GitlabUser';
import {
  handlePullRequestEvent,
  type PullRequestAction,
} from '../events/handlePullRequestEvent';

const VALID_ACTIONS: readonly PullRequestAction[] = [
  'approval',
  'approved',
  'close',
  'merge',
  'reopen',
  'update',
  'open',
  'unapproval',
  'unapproved',
];

export async function mergeRequestHookHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const {
    object_attributes: { detailed_merge_status, action, iid },
    labels,
    project: { id: projectId },
    user,
  } = req.body as {
    object_attributes: {
      action: PullRequestAction;
      detailed_merge_status: string;
      iid: number;
    };
    labels: { title: string }[];
    project: { id: number };
    user: Pick<GitlabUser, 'name' | 'username'> & Partial<GitlabUser>;
  };

  if (!VALID_ACTIONS.includes(action)) {
    res.sendStatus(HTTP_STATUS_NO_CONTENT);
    return;
  }

  await handlePullRequestEvent(
    {
      provider: 'gitlab',
      projectId,
      iid,
      action,
      labels: labels.map(({ title }) => title),
      isMergeable: ['mergeable', 'not_approved'].includes(
        detailed_merge_status,
      ),
      actor: toUnifiedUser({ id: 0, web_url: '', ...user } as GitlabUser),
    },
    (handled) =>
      res.sendStatus(handled ? HTTP_STATUS_OK : HTTP_STATUS_NO_CONTENT),
  );
}
