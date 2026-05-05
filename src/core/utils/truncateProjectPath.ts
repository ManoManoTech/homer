export const SLACK_OPTION_TEXT_MAX_LENGTH = 75;

export function truncateProjectPath(
  path: string,
  maxLength: number = SLACK_OPTION_TEXT_MAX_LENGTH,
): string {
  if (path.length <= maxLength) {
    return path;
  }

  const leaf = path.slice(path.lastIndexOf('/') + 1);
  const ellipsisAndSlash = 2;

  if (leaf.length > maxLength - ellipsisAndSlash - 1) {
    return `…${leaf.slice(-(maxLength - 1))}`;
  }

  const prefixBudget = maxLength - ellipsisAndSlash - leaf.length;
  return `${path.slice(0, prefixBudget)}…/${leaf}`;
}
