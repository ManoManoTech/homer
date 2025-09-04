import { slackifyText } from '@/core/utils/slackifyText';

jest.mock('slackify-markdown', () => (text: string) => text);

const SLACK_CHARACTER_LIMIT = 3000;

describe('slackifyText', () => {
  it('should return the slackified text if within character limit', () => {
    const inputText = 'This is a test message.';
    const truncatedMessage = '[truncated]';
    const result = slackifyText(
      inputText,
      truncatedMessage,
      SLACK_CHARACTER_LIMIT
    );

    expect(result).toBe(inputText);
  });

  it('should truncate the text and append the truncatedMessage if character limit is exceeded', () => {
    const inputText = 'A'.repeat(SLACK_CHARACTER_LIMIT + 100);
    const truncatedMessage = '[truncated]';
    const result = slackifyText(
      inputText,
      truncatedMessage,
      SLACK_CHARACTER_LIMIT
    );

    expect(result).toContain(truncatedMessage);
    expect(result.length).toBeLessThanOrEqual(SLACK_CHARACTER_LIMIT);
  });

  it('should respect provided slackCharacterLimit value', () => {
    const customLimit = 2000;
    const inputText = 'B'.repeat(customLimit + 50);
    const truncatedMessage = '[cut off]';
    const result = slackifyText(inputText, truncatedMessage, customLimit);

    expect(result).toContain(truncatedMessage);
    expect(result.length).toBeLessThanOrEqual(customLimit);
  });

  it('should handle multiline text and truncate appropriately', () => {
    const inputText = `Line1\nLine2\nLine3\n${'C'.repeat(
      SLACK_CHARACTER_LIMIT
    )}`;
    const truncatedMessage = '[truncated]';
    const result = slackifyText(
      inputText,
      truncatedMessage,
      SLACK_CHARACTER_LIMIT
    );

    expect(result.split('\n').length).toBeLessThanOrEqual(
      inputText.split('\n').length
    );
    expect(result).toContain(truncatedMessage);
  });
});
