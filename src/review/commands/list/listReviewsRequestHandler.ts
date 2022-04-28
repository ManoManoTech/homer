import { Response } from 'express';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { getReviewsByChannelId } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import {
  SlackExpressRequest,
  SlackSlashCommandResponse,
} from '@/core/typings/SlackSlashCommand';
import { buildReviewListEphemeral } from './buildReviewListEphemeral';

export async function listReviewsRequestHandler(
  req: SlackExpressRequest,
  res: Response
) {
  res.sendStatus(HTTP_STATUS_NO_CONTENT);

  const { channel_id, user_id } = req.body as SlackSlashCommandResponse;
  const reviews = await getReviewsByChannelId(channel_id);

  await slackBotWebClient.chat.postEphemeral(
    await buildReviewListEphemeral({
      channelId: channel_id,
      reviews,
      userId: user_id,
    })
  );
}
