import { SLACK_CHARACTER_LIMIT, slackifyText } from '@/core/utils/slackifyText';

jest.mock('slackify-markdown', () => (text: string) => text);

describe('slackifyText', () => {
  it('should return the slackified text if within character limit', () => {
    const inputText = 'This is a test message.';
    const truncatedMessage = '[truncated]';
    const result = slackifyText(
      inputText,
      truncatedMessage,
      SLACK_CHARACTER_LIMIT,
    );

    expect(result).toBe(inputText);
  });

  it('should truncate the text and append the truncatedMessage if character limit is exceeded', () => {
    const inputText = 'A'.repeat(SLACK_CHARACTER_LIMIT + 100);
    const truncatedMessage = '[truncated]';
    const result = slackifyText(
      inputText,
      truncatedMessage,
      SLACK_CHARACTER_LIMIT,
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
      SLACK_CHARACTER_LIMIT,
    )}`;
    const truncatedMessage = '[truncated]';
    const result = slackifyText(
      inputText,
      truncatedMessage,
      SLACK_CHARACTER_LIMIT,
    );

    expect(result.split('\n').length).toBeLessThanOrEqual(
      inputText.split('\n').length,
    );
    expect(result).toContain(truncatedMessage);
  });

  it('respects the provided limit even with many lines and a real-world marker (regression for invalid_blocks)', () => {
    // Simulate the budget reserved by slackifyNote for a long <url|View>.
    const customLimit = SLACK_CHARACTER_LIMIT - 81;
    const marker = '*⚠️ Note truncated due to Slack limitations.*';
    const inputText = 'a long line of markdown content\n'.repeat(500);

    const result = slackifyText(inputText, marker, customLimit);

    expect(result.length).toBeLessThanOrEqual(customLimit);
    expect(result.endsWith(marker)).toBe(true);
  });

  it('returns the input unchanged when its length exactly equals the limit', () => {
    const limit = 100;
    const input = 'a'.repeat(limit);
    const result = slackifyText(input, '[truncated]', limit);
    expect(result.length).toBeLessThanOrEqual(limit);
  });

  it('stays under the limit when the function re-inserts newlines between many kept short lines', () => {
    // Concern: join re-inserts a "\n" between every kept line, plus the helper
    // appends "\n\n" + marker. With many short lines, the per-line overhead must
    // still fit inside `slackCharacterLimit`. This test pins down that boundary.
    const limit = 100;
    const marker = '[truncated]';
    const lines = Array.from({ length: 200 }, (_, i) => `L${i}`);
    const inputText = lines.join('\n'); // ~800 chars, dense in newlines

    const result = slackifyText(inputText, marker, limit);

    expect(result.length).toBeLessThanOrEqual(limit);
    expect(result.endsWith(marker)).toBe(true);
    // Body part (before the trailing "\n\n${marker}") still respects the budget.
    const body = result.slice(0, -`\n\n${marker}`.length);
    expect(body.length).toBeLessThanOrEqual(limit - `\n\n${marker}`.length);
  });

  it('stays under the limit when input is exactly limit+1 chars (just-over boundary)', () => {
    const limit = 200;
    const marker = '[truncated]';
    // Many short lines so split-slice-join is meaningfully exercised; length = limit+1.
    const oneLineUnit = 'word\n';
    const lineCount = Math.floor((limit + 1) / oneLineUnit.length);
    const inputText = oneLineUnit.repeat(lineCount).padEnd(limit + 1, 'a');

    const result = slackifyText(inputText, marker, limit);

    expect(result.length).toBeLessThanOrEqual(limit);
    expect(result).toContain(marker);
  });

  it('keeps the total at or under Slack 3000-char block limit when the caller appends a View link after the helper returns', () => {
    // Boundary case mirroring buildNoteMessage / slackifyNote in production:
    // the helper is invoked with a budget reduced by the suffix length, then
    // the caller concatenates the suffix. Total must stay ≤ Slack's hard
    // limit ("must be less than 3001 characters").
    const suffix =
      '<https://my-git.domain.com/group/project/-/merge_requests/1234#note_99999|View>'; // 79 chars
    const budget = SLACK_CHARACTER_LIMIT - suffix.length;
    const marker = '*⚠️ Note truncated due to Slack limitations.*';
    const oversizedInput = 'paragraph of feedback text.\n'.repeat(500);

    const body = slackifyText(oversizedInput, marker, budget);
    const finalText = `${body}${suffix}`;

    expect(body.length).toBeLessThanOrEqual(budget);
    expect(finalText.length).toBeLessThanOrEqual(SLACK_CHARACTER_LIMIT);
    expect(finalText).toContain(marker);
    expect(finalText.endsWith(suffix)).toBe(true);
  });

  it('returns the marker alone when the limit equals marker.length + separator (budgetForBody === 0)', () => {
    const marker = '*⚠️  Note truncated due to Slack limitations.*';
    const inputText = 'oversized note '.repeat(500);

    const tightLimit = marker.length + 2; // SEPARATOR_LENGTH
    const result = slackifyText(inputText, marker, tightLimit);

    expect(result.length).toBeLessThanOrEqual(tightLimit);
    expect(result).toBe(marker);
  });

  it('returns a truncated marker prefix when the limit is smaller than the marker (budgetForBody < 0)', () => {
    const marker = '*⚠️  Note truncated due to Slack limitations.*';
    const inputText = 'oversized note '.repeat(500);

    const tinyLimit = 10;
    const result = slackifyText(inputText, marker, tinyLimit);

    expect(result.length).toBeLessThanOrEqual(tinyLimit);
    expect(result).toBe('*⚠️  Note ');
  });

  it('stays under the limit when input is a single huge line with no newlines', () => {
    // Exercises the path where split('\n') yields a single element, so
    // slice(0, -2) returns [] and the body becomes just the separator + marker.
    const marker = '[truncated]';
    const input = 'x'.repeat(10_000);

    const result = slackifyText(input, marker, SLACK_CHARACTER_LIMIT);

    expect(result.length).toBeLessThanOrEqual(SLACK_CHARACTER_LIMIT);
    expect(result.endsWith(marker)).toBe(true);
  });

  it('stays under the limit when input is dense in paragraph breaks', () => {
    // Exercises the "\n\n" handling across many short paragraphs.
    const marker = '[truncated]';
    const input = 'paragraph here.\n\n'.repeat(500);

    const result = slackifyText(input, marker, SLACK_CHARACTER_LIMIT);

    expect(result.length).toBeLessThanOrEqual(SLACK_CHARACTER_LIMIT);
    expect(result.endsWith(marker)).toBe(true);
  });
});
