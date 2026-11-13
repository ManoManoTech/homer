import type { GitUser } from './GitUser';
import type { PipelineStatus } from './PipelineStatus';
import type { RepoRef } from './RepoRef';

/**
 * Identifies a merge request within its repository: GitLab's `iid` and GitHub's
 * pull request number play the same role.
 */
export interface MergeRequestRef {
  number: number;
}

export type MergeRequestState = 'open' | 'closed' | 'merged' | 'locked';

/**
 * Whether the merge request can be merged. GitHub computes this in the
 * background and reports `null` until it is done, hence `unknown`.
 */
export type Mergeability = 'mergeable' | 'not_mergeable' | 'unknown';

export interface MergeRequest {
  repo: RepoRef;
  ref: MergeRequestRef;
  title: string;
  webUrl: string;
  state: MergeRequestState;
  isDraft: boolean;
  author: GitUser;
  assignees: GitUser[];
  sourceBranch: string;
  targetBranch: string;
  labels: string[];
  /** Total number of comments, which is what both providers can report. */
  discussionCount: number;
  /**
   * Number of changed files, as text: GitLab reports it as a string and caps it
   * at `1000+`, so a number would lose that. The provider adapter formats it.
   */
  changesCount?: string;
  pipelineStatus: PipelineStatus;
  mergeability: Mergeability;
}
