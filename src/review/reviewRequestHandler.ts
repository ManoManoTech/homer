import type { Request, Response } from 'express';
import type { SlackSlashCommandResponse } from '@/core/typings/SlackSlashCommand';
import { listReviewsRequestHandler } from './commands/list/listReviewsRequestHandler';
import { shareReviewRequestHandler } from './commands/share/shareReviewRequestHandler';

export async function reviewRequestHandler(req: Request, res: Response) {
  const { text } = req.body as SlackSlashCommandResponse;
  const command = text?.split(' ')?.[1];

  switch (command) {
    case 'list':
      return listReviewsRequestHandler(req, res);

    default:
      return shareReviewRequestHandler(req, res);
  }
}
