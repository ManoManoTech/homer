import slackifyMarkdown from 'slackify-markdown';

const SLACK_CHARACTER_LIMIT = 3000;

export function slackifyChangelog(changelog: string): string {
  let slackifiedChangelog = slackifyMarkdown(changelog);

  // Slack allows only 3000 characters in text field
  if (slackifiedChangelog.length > SLACK_CHARACTER_LIMIT) {
    slackifiedChangelog = slackifiedChangelog
      .slice(0, SLACK_CHARACTER_LIMIT)
      .split('\n')
      .slice(0, -2)
      .join('\n');

    slackifiedChangelog = `${slackifiedChangelog}\n\n*⚠️ Changelog truncated due to Slack limitations.*`;
  }
  return slackifiedChangelog;
}
