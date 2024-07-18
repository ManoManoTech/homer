import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { deploymentHookHandler } from './commands/create/hookHandlers/deploymentHookHandler';

export async function releaseHookHandler(
  req: Request,
  res: Response
): Promise<void> {
  const { object_kind } = req.body;

  switch (object_kind) {
    case 'deployment':
      return deploymentHookHandler(req, res);

    default:
      res.sendStatus(HTTP_STATUS_NO_CONTENT);
  }
}
