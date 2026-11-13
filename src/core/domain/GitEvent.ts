import type { GitCommit } from './GitCommit';
import type { GitUser } from './GitUser';
import type { MergeRequestRef } from './MergeRequest';
import type { RepoRef } from './RepoRef';

/**
 * What happened to a merge request, reduced to the set both providers can
 * express. GitLab sends these almost one for one; GitHub splits its own
 * actions and review events into them.
 *
 * `approval_withdrawn` has no direct GitHub equivalent: a reviewer can't
 * withdraw an approval there, it is dismissed or superseded by a later review.
 */
export type MrAction =
  | 'opened'
  | 'reopened'
  | 'closed'
  | 'merged'
  | 'updated'
  | 'approved'
  | 'approval_withdrawn';

/**
 * Fields every event carries.
 *
 * `providerPayload` is the untouched provider payload. Only the adapter that
 * produced the event may read it, by narrowing it to its own type: it exists so
 * that a per-provider rule, such as whether to open a review, can look at fields
 * that have no neutral equivalent without those fields reaching the core.
 */
interface GitEventBase {
  repo: RepoRef;
  providerPayload: unknown;
}

export interface MergeRequestEvent extends GitEventBase {
  type: 'merge_request';
  mergeRequest: MergeRequestRef;
  action: MrAction;
  /** Who triggered the event, for the thread message that announces it. */
  actor: GitUser;
  labels: string[];
}

export interface NoteEvent extends GitEventBase {
  type: 'note';
  mergeRequest: MergeRequestRef;
  /**
   * The author's provider id. GitLab note payloads carry only this, so the
   * author has to be fetched; GitHub sends the whole user, which fills `author`
   * and makes that request unnecessary.
   */
  authorId: string;
  author?: GitUser;
  body: string;
  webUrl: string;
}

/**
 * Commits pushed to a branch. Which merge requests that branch belongs to is a
 * provider lookup, so the event names the branch rather than a merge request.
 */
export interface PushEvent extends GitEventBase {
  type: 'push';
  branch: string;
  commits: GitCommit[];
}

export type GitEvent = MergeRequestEvent | NoteEvent | PushEvent;
