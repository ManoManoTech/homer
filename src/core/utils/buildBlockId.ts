import { createHash } from 'node:crypto';

/** Slack rejects any `block_id` longer than 255 characters. */
const MAX_BLOCK_ID_LENGTH = 255;

/**
 * Builds a `block_id` that changes as soon as one of `parts` changes.
 *
 * Slack preserves the state of an input block across `views.update` calls as
 * long as its `block_id` and `action_id` remain the same, ignoring the new
 * `initial_value` / `initial_option`. Giving a block an id derived from the
 * data it displays is the documented way to force Slack to rebuild it.
 *
 * @see https://docs.slack.dev/reference/methods/views.update/
 */
export function buildBlockId(
  prefix: string,
  ...parts: (string | number | undefined)[]
): string {
  const blockId = [
    prefix,
    ...parts.map((part) => `${part ?? 'none'}`.replace(/[^\w.-]/g, '_')),
  ].join('-');

  if (blockId.length <= MAX_BLOCK_ID_LENGTH) {
    return blockId;
  }
  // Hashing instead of truncating prevents collisions between long values.
  return `${prefix}-${createHash('sha1').update(blockId).digest('hex').slice(0, 16)}`;
}
