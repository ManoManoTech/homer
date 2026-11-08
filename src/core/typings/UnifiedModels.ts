import type { ProviderType } from './Provider';

export interface UnifiedUser {
  id: number;
  /** Login on the git provider (ex: josselin.buils). */
  username: string;
  /** Display name, falls back to the username when the provider has none. */
  name: string;
  webUrl: string;
  /** Public email, when the provider exposes it. */
  email?: string;
}

export interface UnifiedProject {
  provider: ProviderType;
  id: number;
  /** ex: group/subgroup/project or owner/repo */
  path: string;
  webUrl: string;
  defaultBranch: string;
}

export type UnifiedPullRequestState = 'opened' | 'closed' | 'merged' | 'locked';

/** Shape shared by GitLab merge requests and GitHub pull requests. */
export interface UnifiedPullRequest {
  provider: ProviderType;
  projectId: number;
  /** GitLab MR iid or GitHub PR number. */
  iid: number;
  title: string;
  webUrl: string;
  state: UnifiedPullRequestState;
  sourceBranch: string;
  targetBranch: string;
  author: UnifiedUser;
  assignees: UnifiedUser[];
  discussionsCount: number;
  changesCount: string;
  /** GitLab pipeline status vocabulary (success, failed, running...). */
  pipelineStatus?: string;
  mergeable: boolean;
}

export interface UnifiedApprovalInfo {
  approvers: UnifiedUser[];
  approvalsRequired: number;
  approvalsLeft: number;
}

export interface UnifiedTag {
  name: string;
  /** Date of the tagged commit. */
  commitDate: string;
}

/** GitLab pipeline or GitHub Actions workflow run. */
export interface UnifiedPipeline {
  id: number;
  sha: string;
  webUrl: string;
}

export interface UnifiedRelease {
  tagName: string;
  name: string;
  description: string;
  releasedAt: string;
}
