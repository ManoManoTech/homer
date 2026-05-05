import {
  SLACK_OPTION_TEXT_MAX_LENGTH,
  truncateProjectPath,
} from '@/core/utils/truncateProjectPath';

describe('truncateProjectPath', () => {
  it('returns the path unchanged when it is within the limit', () => {
    const path = 'group/subgroup/project';
    expect(truncateProjectPath(path)).toBe(path);
  });

  it('returns the path unchanged when it is exactly at the limit', () => {
    const path = `${'a'.repeat(64)}/short-leaf`;
    expect(path.length).toBe(SLACK_OPTION_TEXT_MAX_LENGTH);
    expect(truncateProjectPath(path)).toBe(path);
  });

  it('keeps a prefix of the original path and inserts an ellipsis right before the leaf when the path is too long', () => {
    const longPrefix = `${'a'.repeat(20)}/${'b'.repeat(20)}/${'c'.repeat(20)}/${'d'.repeat(20)}`;
    const leaf = 'my-leaf';
    const path = `${longPrefix}/${leaf}`;

    const result = truncateProjectPath(path);

    expect(result.length).toBeLessThanOrEqual(SLACK_OPTION_TEXT_MAX_LENGTH);
    expect(result).toMatch(/^.+…\/my-leaf$/);
    expect(result.endsWith(`…/${leaf}`)).toBe(true);
    expect(path.startsWith(result.replace(/…\/.+$/, ''))).toBe(true);
  });

  it('truncates the leaf itself with a leading ellipsis when the leaf alone exceeds the budget for "…/leaf"', () => {
    const leaf = 'x'.repeat(100);
    const path = `group/${leaf}`;

    const result = truncateProjectPath(path);

    expect(result.length).toBe(SLACK_OPTION_TEXT_MAX_LENGTH);
    expect(result.startsWith('…')).toBe(true);
    expect(result.slice(1)).toBe(
      leaf.slice(-(SLACK_OPTION_TEXT_MAX_LENGTH - 1)),
    );
  });

  it('handles a path with no slash by treating it as a leaf', () => {
    const leaf = 'y'.repeat(100);

    const result = truncateProjectPath(leaf);

    expect(result.length).toBe(SLACK_OPTION_TEXT_MAX_LENGTH);
    expect(result.startsWith('…')).toBe(true);
    expect(result.slice(1)).toBe(
      leaf.slice(-(SLACK_OPTION_TEXT_MAX_LENGTH - 1)),
    );
  });

  it('respects a custom max length', () => {
    const path = `${'a'.repeat(50)}/leaf`;
    const result = truncateProjectPath(path, 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith('…/leaf')).toBe(true);
  });
});
