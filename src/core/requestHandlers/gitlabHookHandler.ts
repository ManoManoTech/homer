import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { releaseHookHandler } from '@/release/releaseHookHandler';
import { reviewHookHandler } from '@/review/reviewHookHandler';

export async function gitlabHookHandler(
  req: Request,
  res: Response
): Promise<void> {
  const { object_kind } = req.body;

  switch (object_kind) {
    case 'deployment':
      return releaseHookHandler(req, res);

    case 'merge_request':
    case 'note':
    case 'push':
      return reviewHookHandler(req, res);

    default:
      res.sendStatus(HTTP_STATUS_NO_CONTENT);
  }
}
