import slackifyMarkdown from 'slackify-markdown';

export const SLACK_CHARACTER_LIMIT = 2980;

export function slackifyText(
  text: string,
  truncatedMessage: string,
  slackCharacterLimit: number = SLACK_CHARACTER_LIMIT
): string {
  let slackifiedText = slackifyMarkdown(text);

  // Slack allows only 3000 characters in text field
  if (slackifiedText.length > slackCharacterLimit - truncatedMessage.length) {
    slackifiedText = slackifiedText
      .slice(0, SLACK_CHARACTER_LIMIT)
      .split('\n')
      .slice(0, -2)
      .join('\n');

    slackifiedText = `${slackifiedText}\n\n${truncatedMessage}`;
  }
  return slackifiedText;
}
