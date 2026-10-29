import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { CONFIG } from '@/config';
import {
  claimReviewReminder,
  getReviewReminders,
  getReviewsByChannelId,
  releaseReviewReminderClaim,
  removeReviewReminderFromChannel,
  resetReviewReminderFailedAttempts,
} from '@/core/services/data';
import { logger } from '@/core/services/logger';
import { slackBotWebClient } from '@/core/services/slack';
import type { DataReviewReminder } from '@/core/typings/Data';
import { buildReviewListMessage } from '../list/buildReviewListEphemeral';

dayjs.extend(utc);
dayjs.extend(timezone);

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const CHECK_DELAY_AFTER_QUARTER_MS = 1000;
const MAX_RETRIES = 3;
const UNREACHABLE_CHANNEL_SLACK_ERRORS = [
  'channel_not_found',
  'is_archived',
  'not_in_channel',
];

function isUnreachableChannelError(error: unknown): boolean {
  const message = (error as Error)?.message ?? '';
  return UNREACHABLE_CHANNEL_SLACK_ERRORS.some((slackError) =>
    message.includes(slackError),
  );
}

/**
 * Tells whether the reminder of a channel must be posted at `now`: on one of
 * its days, once its time is reached in the configured timezone, and if it
 * has not been posted yet that day.
 *
 * Comparing with "time reached" rather than "time equals" lets an instance
 * started after the scheduled time still post the reminder of the day, and
 * covers the hour skipped when switching to summer time.
 */
export function isReviewReminderDue(
  { days, lastSentOn, time }: DataReviewReminder,
  now: Date,
): boolean {
  const localNow = dayjs(now).tz(CONFIG.reviewReminderTimezone);

  return (
    days.includes(localNow.day()) &&
    localNow.format('HH:mm') >= time &&
    lastSentOn !== localNow.format('YYYY-MM-DD')
  );
}

/**
 * Posts the ongoing reviews in every channel whose reminder is due.
 *
 * Each channel is posted to at most once per day, even if the job runs on
 * several instances. A channel with no ongoing review when its reminder is due
 * gets nothing that day.
 *
 * A failure on one channel does not prevent the other channels from being
 * notified:
 * - if the channel cannot be reached anymore (archived, deleted, Homer
 *   removed), its reminder is removed,
 * - otherwise the claim is released, so the reminder is retried on the next
 *   run, up to {@link MAX_RETRIES} times; after that the reminder is given up
 *   until its next day and a single error is logged.
 */
export async function sendReviewReminders(now = new Date()): Promise<void> {
  const day = dayjs(now).tz(CONFIG.reviewReminderTimezone).format('YYYY-MM-DD');
  const reminders = await getReviewReminders();

  await Promise.all(
    reminders
      .filter((reminder) => isReviewReminderDue(reminder, now))
      .map(async ({ channelId, failedAttempts, lastSentOn }) => {
        try {
          if (!(await claimReviewReminder(channelId, lastSentOn, day))) {
            return;
          }

          const message = await buildReviewListMessage(
            channelId,
            await getReviewsByChannelId(channelId),
          );

          if (message !== undefined) {
            await slackBotWebClient.chat.postMessage(message);
          }
          if (failedAttempts > 0) {
            await resetReviewReminderFailedAttempts(channelId);
          }
        } catch (error) {
          if (isUnreachableChannelError(error)) {
            await removeReviewReminderFromChannel(channelId);
            logger.info(
              `Removed the review reminder of unreachable channel ${channelId}.`,
            );
            return;
          }

          if (failedAttempts < MAX_RETRIES) {
            await releaseReviewReminderClaim(
              channelId,
              day,
              lastSentOn,
              failedAttempts + 1,
            );
            logger.info(
              `Unable to send the review reminder to channel ${channelId}, retrying on the next run: ${
                (error as Error).message
              }`,
            );
            return;
          }

          await resetReviewReminderFailedAttempts(channelId);
          logger.error(
            new Error(
              `Unable to send the review reminder to channel ${channelId} after ${
                MAX_RETRIES + 1
              } attempts, giving up for today: ${
                (error as Error).stack ?? error
              }`,
            ),
          );
        }
      }),
  );
}

/**
 * Checks which reminders are due on every quarter of an hour (:00, :15, :30,
 * :45) until the returned function is called. Checks run slightly after the
 * quarter so that a timer firing a few milliseconds early does not miss a
 * reminder scheduled on it. Timers are unref'd so they never keep the process
 * up.
 *
 * Quarters are computed on UTC time, which matches quarters of every timezone
 * whose offset is a multiple of 15 minutes.
 *
 * @returns a function stopping the checks.
 */
export function scheduleReviewReminders(): () => void {
  let interval: ReturnType<typeof setInterval> | undefined;
  const check = () => {
    sendReviewReminders().catch((error) => logger.error(error));
  };
  const delayToNextQuarter =
    CHECK_INTERVAL_MS - (Date.now() % CHECK_INTERVAL_MS);

  const timeout = setTimeout(() => {
    check();
    interval = setInterval(check, CHECK_INTERVAL_MS).unref();
  }, delayToNextQuarter + CHECK_DELAY_AFTER_QUARTER_MS).unref();

  return () => {
    clearTimeout(timeout);
    clearInterval(interval);
  };
}
