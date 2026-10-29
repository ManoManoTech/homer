import slackifyMarkdown from 'slackify-markdown';
import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { addReviewToChannel, getReviewReminder } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import {
  formatReviewReminderSchedule,
  parseReviewReminderSchedule,
} from '@/review/commands/reminder/reviewReminderSchedule';
import {
  isReviewReminderDue,
  sendReviewReminders,
} from '@/review/commands/reminder/scheduleReviewReminders';
import { mergeRequestDetailsFixture } from '../__fixtures__/mergeRequestDetailsFixture';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockGitlabCall } from '../utils/mockGitlabCall';

const channelId = 'channelId';
const userId = 'userId';
const permalink =
  'https://manomano-team.slack.com/archives/CKXA1FASF/p1640343776000900';

/** Thursday 2026-10-01 at 09:30, Europe/Paris time. */
const THURSDAY_0930 = new Date('2026-10-01T07:30:00Z');

async function sendReminderCommand(options: string) {
  const body = {
    channel_id: channelId,
    text: `review reminder ${options}`.trim(),
    user_id: userId,
  };
  return request(app)
    .post('/api/v1/homer/command')
    .set(getSlackHeaders(body))
    .send(body);
}

async function addOpenReview() {
  const mergeRequestIid = 1;
  const projectId = 1;

  await addReviewToChannel({
    channelId,
    mergeRequestIid,
    projectId,
    ts: 'ts',
  });
  mockGitlabCall(
    `/projects/${projectId}/merge_requests/${mergeRequestIid}`,
    mergeRequestDetailsFixture,
  );
  (slackBotWebClient.chat.getPermalink as jest.Mock).mockReturnValue({
    permalink,
  });
}

describe('review > reminder', () => {
  describe('command', () => {
    it('should enable the reminder on weekdays at 09:30 by default', async () => {
      // When
      const response = await sendReminderCommand('on');

      // Then
      expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
      expect(await getReviewReminder(channelId)).toEqual({
        channelId,
        days: [1, 2, 3, 4, 5],
        failedAttempts: 0,
        lastSentOn: null,
        time: '09:30',
      });
      expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledWith({
        channel: channelId,
        user: userId,
        text: 'Ongoing reviews will be posted in this channel every weekday at 09:30 (Europe/Paris time) :homer-happy:',
      });
    });

    it('should enable the reminder with a custom schedule', async () => {
      // When
      await sendReminderCommand('on 10:00 mon,wed,fri');

      // Then
      expect(await getReviewReminder(channelId)).toMatchObject({
        days: [1, 3, 5],
        time: '10:00',
      });
      expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledWith({
        channel: channelId,
        user: userId,
        text: 'Ongoing reviews will be posted in this channel every Monday, Wednesday and Friday at 10:00 (Europe/Paris time) :homer-happy:',
      });
    });

    it('should replace the schedule of an enabled reminder', async () => {
      // Given
      await sendReminderCommand('on');

      // When
      await sendReminderCommand('on 14:00 mon');

      // Then
      expect(await getReviewReminder(channelId)).toMatchObject({
        days: [1],
        time: '14:00',
      });
    });

    it('should reject an invalid schedule', async () => {
      // When
      await sendReminderCommand('on 25:00');

      // Then
      expect(await getReviewReminder(channelId)).toBeUndefined();
      expect(
        (slackBotWebClient.chat.postEphemeral as jest.Mock).mock.calls[0][0]
          .text,
      ).toContain("D'oh! I don't understand `25:00`");
    });

    it('should display the current schedule', async () => {
      // Given
      await sendReminderCommand('on 09:00 mon-thu');

      // When
      await sendReminderCommand('');

      // Then
      expect(slackBotWebClient.chat.postEphemeral).toHaveBeenLastCalledWith({
        channel: channelId,
        user: userId,
        text: 'Ongoing reviews are posted in this channel every Monday, Tuesday, Wednesday and Thursday at 09:00 (Europe/Paris time). Use `/homer review reminder off` to stop it.',
      });
    });

    it('should disable the reminder', async () => {
      // Given
      await sendReminderCommand('on');

      // When
      const response = await sendReminderCommand('off');

      // Then
      expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
      expect(await getReviewReminder(channelId)).toBeUndefined();
    });
  });

  describe('sending', () => {
    it('should post ongoing reviews once a day in enabled channels', async () => {
      // Given
      await sendReminderCommand('on');
      await addOpenReview();

      // When
      await sendReviewReminders(THURSDAY_0930);
      await sendReviewReminders(new Date('2026-10-01T07:45:00Z'));

      // Then
      expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(1);
      expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith({
        blocks: [
          {
            text: {
              text: slackifyMarkdown(
                `**Ongoing reviews:**\n- [merge request title](${permalink})`,
              ),
              type: 'mrkdwn',
            },
            type: 'section',
          },
        ],
        channel: channelId,
        text: 'Ongoing reviews: merge request title.',
      });
    });

    it('should post again the next day', async () => {
      // Given
      await sendReminderCommand('on');
      await addOpenReview();

      // When
      await sendReviewReminders(THURSDAY_0930);
      await sendReviewReminders(new Date('2026-10-02T07:30:00Z'));

      // Then
      expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(2);
    });

    it('should not post when the reminder is not due', async () => {
      // Given
      await sendReminderCommand('on 10:00');
      await addOpenReview();

      // When
      await sendReviewReminders(THURSDAY_0930);

      // Then
      expect(slackBotWebClient.chat.postMessage).not.toHaveBeenCalled();
    });

    it('should not post when there is no ongoing review', async () => {
      // Given
      await sendReminderCommand('on');

      // When
      await sendReviewReminders(THURSDAY_0930);

      // Then
      expect(slackBotWebClient.chat.postMessage).not.toHaveBeenCalled();
    });

    it('should retry on the next run when posting fails', async () => {
      // Given
      await sendReminderCommand('on');
      await addOpenReview();
      (slackBotWebClient.chat.postMessage as jest.Mock).mockRejectedValueOnce(
        new Error('An API error occurred: ratelimited'),
      );

      // When
      await sendReviewReminders(THURSDAY_0930);
      await sendReviewReminders(new Date('2026-10-01T07:45:00Z'));

      // Then
      expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(2);
      expect(await getReviewReminder(channelId)).toMatchObject({
        failedAttempts: 0,
        lastSentOn: '2026-10-01',
      });
    });

    it('should give up for the day after 3 retries', async () => {
      // Given
      await sendReminderCommand('on');
      await addOpenReview();
      (slackBotWebClient.chat.postMessage as jest.Mock).mockRejectedValue(
        new Error('An API error occurred: internal_error'),
      );

      // When
      for (let quarter = 0; quarter < 6; quarter += 1) {
        await sendReviewReminders(
          new Date(THURSDAY_0930.getTime() + quarter * 15 * 60 * 1000),
        );
      }

      // Then
      expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(4);
      expect(await getReviewReminder(channelId)).toMatchObject({
        failedAttempts: 0,
        lastSentOn: '2026-10-01',
      });
    });

    it('should remove the reminder of an unreachable channel', async () => {
      // Given
      await sendReminderCommand('on');
      await addOpenReview();
      (slackBotWebClient.chat.postMessage as jest.Mock).mockRejectedValueOnce(
        new Error('An API error occurred: not_in_channel'),
      );

      // When
      await sendReviewReminders(THURSDAY_0930);

      // Then
      expect(await getReviewReminder(channelId)).toBeUndefined();
    });

    it('should not post when the reminder is disabled', async () => {
      // Given
      await addOpenReview();

      // When
      await sendReviewReminders(THURSDAY_0930);

      // Then
      expect(slackBotWebClient.chat.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('isReviewReminderDue', () => {
    const reminder = {
      channelId,
      days: [1, 2, 3, 4, 5],
      failedAttempts: 0,
      lastSentOn: null,
      time: '09:30',
    };

    it.each([
      ['at the scheduled time', reminder, '2026-10-01T07:30:00Z', true],
      ['after the scheduled time', reminder, '2026-10-01T15:00:00Z', true],
      ['before the scheduled time', reminder, '2026-10-01T07:15:00Z', false],
      ['on a day off', reminder, '2026-10-03T07:30:00Z', false],
      [
        'when already sent that day',
        { ...reminder, lastSentOn: '2026-10-01' },
        '2026-10-01T07:30:00Z',
        false,
      ],
      ['in winter time', reminder, '2026-10-26T08:30:00Z', true],
      [
        'in winter time, before the scheduled time',
        reminder,
        '2026-10-26T08:00:00Z',
        false,
      ],
    ])('%s', (_, testedReminder, now, expected) => {
      expect(isReviewReminderDue(testedReminder, new Date(now))).toEqual(
        expected,
      );
    });
  });

  describe('parseReviewReminderSchedule', () => {
    it.each([
      [[], { days: [1, 2, 3, 4, 5], time: '09:30' }],
      [['9:15'], { days: [1, 2, 3, 4, 5], time: '09:15' }],
      [['10h00'], { days: [1, 2, 3, 4, 5], time: '10:00' }],
      [['mon,wed,fri'], { days: [1, 3, 5], time: '09:30' }],
      [['Fri,MON'], { days: [1, 5], time: '09:30' }],
      [['mon-wed,fri'], { days: [1, 2, 3, 5], time: '09:30' }],
      [['sat', '18:00'], { days: [6], time: '18:00' }],
      [['sun-sat'], { days: [0, 1, 2, 3, 4, 5, 6], time: '09:30' }],
      [['mon-sun'], { days: [0, 1, 2, 3, 4, 5, 6], time: '09:30' }],
      [['sat-sun'], { days: [0, 6], time: '09:30' }],
    ])('should parse %j', (args, expected) => {
      expect(parseReviewReminderSchedule(args)).toEqual(expected);
    });

    it.each([
      [['24:00']],
      [['9:5']],
      [['09:10']],
      [['monday']],
      [['fri-mon']],
      [['mon-']],
      [['mon-wed-fri']],
      [['mon,']],
      [['09:00', '10:00']],
      [['mon', 'tue']],
    ])('should reject %j', (args) => {
      expect(parseReviewReminderSchedule(args)).toBeUndefined();
    });
  });

  describe('formatReviewReminderSchedule', () => {
    it.each([
      [{ days: [0, 1, 2, 3, 4, 5, 6], time: '09:30' }, 'every day at 09:30'],
      [{ days: [1, 2, 3, 4, 5], time: '09:30' }, 'every weekday at 09:30'],
      [{ days: [1], time: '14:00' }, 'every Monday at 14:00'],
      [{ days: [1, 5], time: '10:00' }, 'every Monday and Friday at 10:00'],
    ])('should format %j', (schedule, expected) => {
      expect(formatReviewReminderSchedule(schedule)).toEqual(expected);
    });
  });
});
