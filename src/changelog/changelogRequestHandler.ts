import type { Response } from 'express';
import { GENERIC_ERROR_MESSAGE, HTTP_STATUS_NO_CONTENT } from '@/constants';
import { slackBotWebClient } from '@/core/services/slack';
import type { SlackExpressRequest } from '@/core/typings/SlackSlashCommand';
import { buildChangelogModalView } from './buildChangelogModalView';

export async function changelogRequestHandler(
  req: SlackExpressRequest,
  res: Response
) {
  const { channel_id, trigger_id, user_id } = req.body;

  res.sendStatus(HTTP_STATUS_NO_CONTENT);

  try {
    await slackBotWebClient.views.open({
      trigger_id,
      view: await buildChangelogModalView({ channelId: channel_id }),
    });
  } catch (error) {
    await slackBotWebClient.chat.postEphemeral({
      channel: channel_id,
      user: user_id,
      text: error instanceof Error ? error.message : GENERIC_ERROR_MESSAGE,
    });
  }
}
