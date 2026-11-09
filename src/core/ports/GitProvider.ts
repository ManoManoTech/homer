import type { ApprovalInfo } from '@/core/domain/ApprovalInfo';
import type { GitCommit } from '@/core/domain/GitCommit';
import type { GitUser } from '@/core/domain/GitUser';
import type { MergeRequest, MergeRequestRef } from '@/core/domain/MergeRequest';
import type { GitProviderName, Repo, RepoRef } from '@/core/domain/RepoRef';

/**
 * Everything the merge request notification feature reads from a git provider.
 * Implemented once per provider; the code above it never sees a provider's own
 * payloads.
 */
export interface GitProvider {
  readonly provider: GitProviderName;

  getMergeRequest(
    repo: RepoRef,
    mergeRequest: MergeRequestRef,
  ): Promise<MergeRequest>;

  getApprovalInfo(
    repo: RepoRef,
    mergeRequest: MergeRequestRef,
  ): Promise<ApprovalInfo>;

  /**
   * Everyone expected to review, whether or not they already did. GitHub drops
   * a reviewer from its requested list once they submit a review, so its
   * adapter adds the authors of submitted reviews back in.
   */
  getReviewers(
    repo: RepoRef,
    mergeRequest: MergeRequestRef,
  ): Promise<GitUser[]>;

  getProject(repo: RepoRef): Promise<Repo>;

  /** Merge requests whose source branch is `branchName`. */
  getMergeRequestsByBranch(
    repo: RepoRef,
    branchName: string,
  ): Promise<MergeRequest[]>;

  getMergeRequestCommits(
    repo: RepoRef,
    mergeRequest: MergeRequestRef,
  ): Promise<GitCommit[]>;

  /** Returns `undefined` when the provider doesn't know the user. */
  getUserById(id: string): Promise<GitUser | undefined>;
}
