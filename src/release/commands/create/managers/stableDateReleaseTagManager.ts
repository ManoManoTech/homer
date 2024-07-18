import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import type { ReleaseTagManager } from '../../../typings/ReleaseTagManager';

dayjs.extend(utc);
dayjs.extend(timezone);

/** stable-YYYYMMDD-HHmm */
export function createReleaseTag(): string {
  return `stable-${dayjs().tz('Europe/Paris').format('YYYYMMDD-HHmm')}`;
}

function isReleaseTag(tag: string): boolean {
  return /^stable-\d{8}-\d{4}$/.test(tag);
}

export const stableDateReleaseTagManager: ReleaseTagManager = {
  createReleaseTag,
  isReleaseTag,
};
