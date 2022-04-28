import { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { mergeRequestHookHandler } from './commands/share/hookHandlers/mergeRequestHookHandler';
import { noteHookHandler } from './commands/share/hookHandlers/noteHookHandler';
import { pushHookHandler } from './commands/share/hookHandlers/pushHookHandler';

export async function reviewHookHandler(
  req: Request,
  res: Response
): Promise<void> {
  const { object_kind } = req.body;
  switch (object_kind) {
    case 'merge_request':
      return mergeRequestHookHandler(req, res);

    case 'note':
      return noteHookHandler(req, res);

    case 'push':
      return pushHookHandler(req, res);

    default:
      res.sendStatus(HTTP_STATUS_NO_CONTENT);
  }
}
