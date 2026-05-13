import slackifyMarkdown from 'slackify-markdown';

// Matches Slack's hard limit on section block text: "must be less than 3001
// characters" — i.e. length ≤ 3000. Callers that need to append a suffix
// (e.g. a `<url|View>` link) MUST pass `slackCharacterLimit - suffix.length`
// so the assembled output still respects this bound.
export const SLACK_CHARACTER_LIMIT = 3000;

const SEPARATOR_LENGTH = 2; // for "\n\n"

export function slackifyText(
  text: string,
  truncatedMessage: string,
  slackCharacterLimit: number = SLACK_CHARACTER_LIMIT,
): string {
  const slackifiedText = slackifyMarkdown(text);

  if (slackifiedText.length <= slackCharacterLimit) {
    return slackifiedText;
  }

  const budgetForBody =
    slackCharacterLimit - truncatedMessage.length - SEPARATOR_LENGTH;

  if (budgetForBody <= 0) {
    return truncatedMessage.slice(0, slackCharacterLimit);
  }

  const truncatedBody = slackifiedText
    .slice(0, budgetForBody)
    .split('\n')
    .slice(0, -2)
    .join('\n');

  return `${truncatedBody}\n\n${truncatedMessage}`;
}
