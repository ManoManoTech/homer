import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

function createReleaseTag(appName: string): string {
  return `mf-${appName}-${dayjs().tz('Europe/Paris').format('YYYYMMDD-HHmm')}`;
}

function extractAppName(tag: string): string {
  const appName = tag.match(/^mf-([a-z]+)-\d{8}-\d{4}$/)?.[1];

  if (appName === undefined) {
    throw new Error(`Unable to extract app name from '${tag}'`);
  }
  return appName;
}

function isReleaseTag(tag: string, appName?: string): boolean {
  return new RegExp(`^mf-${appName ?? '[a-z]+'}-\\d{8}-\\d{4}$`).test(tag);
}

export const federationReleaseTagManager = {
  createReleaseTag,
  extractAppName,
  isReleaseTag,
};
