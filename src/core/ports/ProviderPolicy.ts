import type { MergeRequestEvent } from '@/core/domain/GitEvent';
import type { GitProviderName } from '@/core/domain/RepoRef';

/**
 * Decisions that read a provider's own notion of a merge request's state, and
 * therefore can't be shared. Implemented next to that provider's adapter, which
 * is the only code allowed to read `providerPayload` on the event.
 */
export interface ProviderPolicy {
  readonly provider: GitProviderName;

  /**
   * Whether an event should make Homer post a review message for a merge
   * request it isn't yet tracking.
   *
   * GitLab answers from the labels and the merge status in the payload. GitHub
   * has no field meaning "ready except for approvals" and computes mergeability
   * in the background, so its rule may have to read the pull request again:
   * the answer is a promise for that reason, not because GitLab needs it.
   */
  shouldOpenReview(event: MergeRequestEvent): Promise<boolean>;
}
