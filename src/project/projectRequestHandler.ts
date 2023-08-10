import type { Response } from 'express';
import type { SlackExpressRequest } from '@/core/typings/SlackSlashCommand';
import { buildHelpMessage } from '@/core/viewBuilders/buildHelpMessage';
import { addProjectRequestHandler } from './commands/add/addProjectRequestHandler';
import { listProjectsRequestHandler } from './commands/list/listProjectsRequestHandler';
import { removeProjectHandler } from './commands/remove/removeProjectHandler';

export async function projectRequestHandler(
  req: SlackExpressRequest,
  res: Response
) {
  const { channel_id, text } = req.body;
  const command = text?.split(' ')?.[1];

  switch (command) {
    case 'add':
      return addProjectRequestHandler(req, res);

    case 'list':
      return listProjectsRequestHandler(req, res);

    case 'remove':
      return removeProjectHandler(req, res);

    default:
      res.send(buildHelpMessage(channel_id));
  }
}
