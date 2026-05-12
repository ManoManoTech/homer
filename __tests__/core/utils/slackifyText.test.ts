import {
  SLACK_CHARACTER_LIMIT as REAL_SLACK_CHARACTER_LIMIT,
  slackifyText,
} from '@/core/utils/slackifyText';

jest.mock('slackify-markdown', () => (text: string) => text);

// Existing tests reference a 3000-char limit; the real module constant
// (REAL_SLACK_CHARACTER_LIMIT) is 2980 — a deliberate 20-char safety margin
// below Slack's 3000-char hard limit on block text.
const SLACK_CHARACTER_LIMIT = 3000;

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
    const customLimit = 2980 - 81; // simulate the budget reserved by slackifyNote for a long <url|View>
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

  it('keeps the total under Slack 3000-char block limit when the caller appends a View link after the helper returns', () => {
    // Boundary case mirroring buildNoteMessage / slackifyNote in production:
    // the helper is invoked with a budget reduced by the suffix length, then
    // the caller concatenates the suffix. Total must stay ≤ Slack's hard limit.
    const SLACK_HARD_LIMIT = 3000;
    const suffix =
      '<https://my-git.domain.com/group/project/-/merge_requests/1234#note_99999|View>'; // 79 chars
    const budget = REAL_SLACK_CHARACTER_LIMIT - suffix.length;
    const marker = '*⚠️ Note truncated due to Slack limitations.*';
    const oversizedInput = 'paragraph of feedback text.\n'.repeat(500);

    const body = slackifyText(oversizedInput, marker, budget);
    const finalText = `${body}${suffix}`;

    expect(body.length).toBeLessThanOrEqual(budget);
    expect(finalText.length).toBeLessThanOrEqual(REAL_SLACK_CHARACTER_LIMIT);
    expect(finalText.length).toBeLessThan(SLACK_HARD_LIMIT);
    expect(finalText).toContain(marker);
    expect(finalText.endsWith(suffix)).toBe(true);
  });

  it('returns the marker alone if limit is too small to fit any of the original text', () => {
    const marker = '*⚠️  Note truncated due to Slack limitations.*';
    const inputText = 'oversized note '.repeat(500);

    // Case A: budgetForBody === 0 (limit exactly fits marker + separator).
    const tightLimit = marker.length + 2; // SEPARATOR_LENGTH
    const tightResult = slackifyText(inputText, marker, tightLimit);
    expect(tightResult.length).toBeLessThanOrEqual(tightLimit);
    expect(tightResult).toBe(marker);
  });

  it('returns the marker alone if limit is too small to fit any of the original text', () => {
    const marker = '*⚠️  Note truncated due to Slack limitations.*';
    const inputText = 'oversized note '.repeat(500);

    // Case B: budgetForBody < 0 (limit smaller than marker + separator).
    const tinyLimit = 10;
    const tinyResult = slackifyText(inputText, marker, tinyLimit);
    expect(tinyResult.length).toBeLessThanOrEqual(tinyLimit);
    expect(tinyResult).toBe('*⚠️  Note ');
  });
});
