import { slackifyText } from '@/core/utils/slackifyText';

export function slackifyChangelog(changelog: string): string {
  return slackifyText(
    changelog,
    '*⚠️ Changelog truncated due to Slack limitations.*'
  );
}
