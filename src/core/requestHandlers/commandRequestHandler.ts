import type { Response } from 'express';
import { changelogRequestHandler } from '@/changelog/changelogRequestHandler';
import { projectRequestHandler } from '@/project/projectRequestHandler';
import { reviewRequestHandler } from '@/review/reviewRequestHandler';
import type { SlackExpressRequest } from '../typings/SlackSlashCommand';
import { buildHelpMessage } from '../viewBuilders/buildHelpMessage';

export async function commandRequestHandler(
  req: SlackExpressRequest,
  res: Response
) {
  const { channel_id, text } = req.body;
  const command = text?.split(' ')?.[0];

  switch (command) {
    case 'changelog':
      return changelogRequestHandler(req, res);

    case 'project':
      return projectRequestHandler(req, res);

    case 'review':
      return reviewRequestHandler(req, res);

    default:
      res.send(buildHelpMessage(channel_id));
  }
}
