import type { Response } from 'express';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { slackBotWebClient } from '@/core/services/slack';
import type {
  SlackExpressRequest,
  SlackSlashCommandResponse,
} from '@/core/typings/SlackSlashCommand';
import { buildReleaseModalView } from './viewBuilders/buildReleaseModalView';

export async function createReleaseRequestHandler(
  req: SlackExpressRequest,
  res: Response
) {
  res.sendStatus(HTTP_STATUS_NO_CONTENT);

  const { channel_id, trigger_id } = req.body as SlackSlashCommandResponse;

  await slackBotWebClient.views.open({
    trigger_id,
    view: await buildReleaseModalView({ channelId: channel_id }),
  });
}
