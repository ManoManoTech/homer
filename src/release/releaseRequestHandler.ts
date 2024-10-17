import type { Response } from 'express';
import { HOMER_GIT_URL } from '@/constants';
import type {
  SlackExpressRequest,
  SlackSlashCommandResponse,
} from '@/core/typings/SlackSlashCommand';
import { endReleaseRequestHandler } from '@/release/commands/end/endReleaseRequestHandler';
import { cancelReleaseRequestHandler } from './commands/cancel/cancelReleaseRequestHandler';
import { createReleaseRequestHandler } from './commands/create/createReleaseRequestHandler';
import ConfigHelper from './utils/ConfigHelper';

export async function releaseRequestHandler(
  req: SlackExpressRequest,
  res: Response
) {
  const { channel_id, text } = req.body as SlackSlashCommandResponse;

  if (!(await ConfigHelper.hasChannelReleaseConfigs(channel_id))) {
    res.send(
      `The release command cannot be used in this channel because it has not been set up (or not correctly) in the config file, please follow the <${HOMER_GIT_URL}#configure-homer-to-release-a-gitlab-project|corresponding documentation> :homer-donut:`
    );
    return;
  }

  const command = text?.split(' ')?.[1];

  switch (command) {
    case 'cancel':
      return cancelReleaseRequestHandler(req, res);

    case 'end':
      return endReleaseRequestHandler(req, res);

    default:
      return createReleaseRequestHandler(req, res);
  }
}
