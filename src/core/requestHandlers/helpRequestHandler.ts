import type { Response } from 'express';
import type { SlackExpressRequest } from '../typings/SlackSlashCommand';
import { buildHelpMessage } from '../viewBuilders/buildHelpMessage';

export function helpRequestHandler(req: SlackExpressRequest, res: Response) {
  res.send(buildHelpMessage(req.body.channel_id));
}
