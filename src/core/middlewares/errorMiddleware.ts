import { WebAPICallResult } from '@slack/web-api';
import { NextFunction, Request, Response } from 'express';
import {
  CHANNEL_NOT_FOUND_SLACK_ERROR,
  GENERIC_ERROR_MESSAGE,
  PRIVATE_CHANNEL_ERROR_MESSAGE,
} from '@/constants';
import { logger } from '@/core/services/logger';
import { slackBotWebClient } from '@/core/services/slack';

export async function errorMiddleware(
  error: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction // Needs to be kept even if not used
): Promise<void> {
  // When someone tries to use Homer on a private channel
  const isChannelNotFoundError =
    error.message?.includes(CHANNEL_NOT_FOUND_SLACK_ERROR) ?? false;

  const errorMessage = isChannelNotFoundError
    ? PRIVATE_CHANNEL_ERROR_MESSAGE
    : GENERIC_ERROR_MESSAGE;

  if (!isChannelNotFoundError) {
    logger.error(error);
  }

  if (!res.headersSent) {
    res.send(errorMessage);
  } else if (req.body.channel_id && req.body.user_id) {
    const { channel_id, user_id } = req.body;

    if (isChannelNotFoundError) {
      const { channel } = (await slackBotWebClient.conversations.open({
        users: user_id,
      })) as WebAPICallResult & { channel: { id: string } };

      await slackBotWebClient.chat.postMessage({
        channel: channel.id,
        user: user_id,
        text: PRIVATE_CHANNEL_ERROR_MESSAGE,
      });
    } else {
      await slackBotWebClient.chat.postEphemeral({
        channel: channel_id,
        user: user_id,
        text: GENERIC_ERROR_MESSAGE,
      });
    }
  }
}
