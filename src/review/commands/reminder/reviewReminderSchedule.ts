import type { DataReviewReminder } from '@/core/typings/Data';

export type ReviewReminderSchedule = Pick<DataReviewReminder, 'days' | 'time'>;

const WEEK_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WEEK_DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const SUNDAY = 0;
const WORKING_DAYS = [1, 2, 3, 4, 5];
const TIME_REGEXP = /^([01]?\d|2[0-3])[:h](00|15|30|45)$/;

export const DEFAULT_REVIEW_REMINDER_SCHEDULE: ReviewReminderSchedule = {
  days: WORKING_DAYS,
  time: '09:30',
};

export const REVIEW_REMINDER_USAGE =
  '`/homer review reminder on [HH:mm] [mon,tue,wed,thu,fri,sat,sun]` with minutes among 00, 15, 30 or 45, e.g. `/homer review reminder on 10:00 mon,wed,fri` or `/homer review reminder on 09:15 mon-fri`';

function parseTime(arg: string): string | undefined {
  const match = TIME_REGEXP.exec(arg);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : undefined;
}

function parseWeekDay(arg: string): number | undefined {
  const day = WEEK_DAYS.indexOf(arg);
  return day !== -1 ? day : undefined;
}

/**
 * Parses `mon,wed,fri`, `mon-fri` or a mix of both, e.g. `mon-wed,fri`.
 * Sunday can end a range (`mon-sun`), but ranges do not wrap around the week
 * otherwise: `fri-mon` is invalid.
 */
function parseDays(arg: string): number[] | undefined {
  const days = new Set<number>();

  for (const item of arg.split(',')) {
    const bounds = item.split('-').map(parseWeekDay);
    const [start, end = start] = bounds;

    if (
      bounds.length > 2 ||
      bounds.includes(undefined) ||
      start === undefined ||
      end === undefined
    ) {
      return undefined;
    }

    const rangeEnd =
      end === SUNDAY && start !== SUNDAY ? WEEK_DAYS.length : end;

    if (rangeEnd < start) {
      return undefined;
    }
    for (let day = start; day <= rangeEnd; day += 1) {
      days.add(day % WEEK_DAYS.length);
    }
  }
  return [...days].sort((a, b) => a - b);
}

/**
 * Parses the options of `/homer review reminder on`: an optional time, on a
 * quarter of an hour to match the reminder job period, and an optional list
 * of days, in any order. Missing options fall back to
 * {@link DEFAULT_REVIEW_REMINDER_SCHEDULE}. Day names are case-insensitive.
 *
 * @returns `undefined` if an option is invalid or given twice.
 */
export function parseReviewReminderSchedule(
  args: string[],
): ReviewReminderSchedule | undefined {
  let days: number[] | undefined;
  let time: string | undefined;

  for (const arg of args.map((value) => value.toLowerCase())) {
    const parsedTime = parseTime(arg);

    if (parsedTime !== undefined) {
      if (time !== undefined) {
        return undefined;
      }
      time = parsedTime;
    } else {
      const parsedDays = parseDays(arg);

      if (parsedDays === undefined || days !== undefined) {
        return undefined;
      }
      days = parsedDays;
    }
  }

  return {
    days: days ?? DEFAULT_REVIEW_REMINDER_SCHEDULE.days,
    time: time ?? DEFAULT_REVIEW_REMINDER_SCHEDULE.time,
  };
}

/** Formats a schedule for Slack, e.g. `every Monday and Friday at 10:00`. */
export function formatReviewReminderSchedule({
  days,
  time,
}: ReviewReminderSchedule): string {
  if (days.length === WEEK_DAYS.length) {
    return `every day at ${time}`;
  }
  if (days.join(',') === WORKING_DAYS.join(',')) {
    return `every weekday at ${time}`;
  }

  const names = days.map((day) => WEEK_DAY_NAMES[day]);
  const formattedDays =
    names.length > 1
      ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
      : names[0];

  return `every ${formattedDays} at ${time}`;
}
