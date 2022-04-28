import { Response } from 'express';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { slackBotWebClient } from '@/core/services/slack';
import {
  SlackExpressRequest,
  SlackSlashCommandResponse,
} from '@/core/typings/SlackSlashCommand';
import { buildRemoveProjectSelectionEphemeral } from './buildRemoveProjectSelectionEphemeral';

export async function removeProjectHandler(
  req: SlackExpressRequest,
  res: Response
) {
  res.sendStatus(HTTP_STATUS_NO_CONTENT);

  const { channel_id, user_id } = req.body as SlackSlashCommandResponse;

  await slackBotWebClient.chat.postEphemeral(
    await buildRemoveProjectSelectionEphemeral({
      channelId: channel_id,
      userId: user_id,
    })
  );
}
