import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';

export async function githubHookHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const event = req.header('X-GitHub-Event');

  switch (event) {
    // Sent when the webhook is created.
    case 'ping':
      res.sendStatus(HTTP_STATUS_OK);
      return;

    default:
      res.sendStatus(HTTP_STATUS_NO_CONTENT);
  }
}
