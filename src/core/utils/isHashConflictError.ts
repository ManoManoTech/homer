import { HASH_CONFLICT_SLACK_ERROR } from '@/constants';

/**
 * Slack rejects a views.update carrying an outdated hash, which is how a
 * rebuild that another interaction has already superseded is discarded.
 */
export function isHashConflictError(error: unknown): boolean {
  return (
    (error as { data?: { error?: string } })?.data?.error ===
    HASH_CONFLICT_SLACK_ERROR
  );
}
