import type { WebAPICallResult } from '@slack/web-api';
import type { NextFunction, Request, Response } from 'express';
import {
  CHANNEL_NOT_FOUND_SLACK_ERROR,
  EXPIRED_TRIGGER_ID_ERROR_MESSAGE,
  EXPIRED_TRIGGER_ID_SLACK_ERROR,
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
  // When someone tries to use Homer on a private channel it is not in
  const isChannelNotFoundError =
    error.message?.includes(CHANNEL_NOT_FOUND_SLACK_ERROR) ?? false;

  const isExpiredTriggeredIdError =
    error.message?.includes(EXPIRED_TRIGGER_ID_SLACK_ERROR) ?? false;

  let errorMessage: string;

  if (isChannelNotFoundError) {
    errorMessage = PRIVATE_CHANNEL_ERROR_MESSAGE;
  } else if (isExpiredTriggeredIdError) {
    errorMessage = EXPIRED_TRIGGER_ID_ERROR_MESSAGE;
  } else {
    errorMessage = GENERIC_ERROR_MESSAGE;
  }

  logger.error(error);

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
        text: errorMessage,
      });
    } else {
      await slackBotWebClient.chat.postEphemeral({
        channel: channel_id,
        user: user_id,
        text: errorMessage,
      });
    }
  }
}
