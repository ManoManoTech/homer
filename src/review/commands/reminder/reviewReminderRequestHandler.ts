import type { Response } from 'express';
import { CONFIG } from '@/config';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import {
  getReviewReminder,
  removeReviewReminderFromChannel,
  setReviewReminder,
} from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import type {
  SlackExpressRequest,
  SlackSlashCommandResponse,
} from '@/core/typings/SlackSlashCommand';
import { buildHelpMessage } from '@/core/viewBuilders/buildHelpMessage';
import {
  formatReviewReminderSchedule,
  parseReviewReminderSchedule,
  REVIEW_REMINDER_USAGE,
} from './reviewReminderSchedule';

/**
 * Handles `/homer review reminder [on [time] [days]|off]`:
 * - `on` enables the scheduled post of the ongoing reviews in the channel,
 *   or replaces its schedule,
 * - `off` disables it,
 * - no option displays the current schedule.
 *
 * Any other option replies with the help.
 */
export async function reviewReminderRequestHandler(
  req: SlackExpressRequest,
  res: Response,
) {
  const { text, channel_id, user_id } = req.body as SlackSlashCommandResponse;
  const [option, ...args] = text.split(' ').filter(Boolean).slice(2);

  const reply = (replyText: string) =>
    slackBotWebClient.chat.postEphemeral({
      channel: channel_id,
      user: user_id,
      text: replyText,
    });

  switch (option) {
    case undefined: {
      res.sendStatus(HTTP_STATUS_NO_CONTENT);
      const reminder = await getReviewReminder(channel_id);
      await reply(
        reminder !== undefined
          ? `Ongoing reviews are posted in this channel ${formatReviewReminderSchedule(
              reminder,
            )} (${CONFIG.reviewReminderTimezone} time). Use \`/homer review reminder off\` to stop it.`
          : `Ongoing reviews are not posted in this channel. Use ${REVIEW_REMINDER_USAGE} to do so.`,
      );
      return;
    }

    case 'on': {
      res.sendStatus(HTTP_STATUS_NO_CONTENT);
      const schedule = parseReviewReminderSchedule(args);

      if (schedule === undefined) {
        await reply(
          `D'oh! I don't understand \`${args.join(
            ' ',
          )}\` :homer-stressed: Usage: ${REVIEW_REMINDER_USAGE}.`,
        );
        return;
      }

      await setReviewReminder({ channelId: channel_id, ...schedule });
      await reply(
        `Ongoing reviews will be posted in this channel ${formatReviewReminderSchedule(
          schedule,
        )} (${CONFIG.reviewReminderTimezone} time) :homer-happy:`,
      );
      return;
    }

    case 'off':
      res.sendStatus(HTTP_STATUS_NO_CONTENT);
      await removeReviewReminderFromChannel(channel_id);
      await reply('Ongoing reviews will no longer be posted in this channel.');
      return;

    default:
      res.send(buildHelpMessage(channel_id));
  }
}
