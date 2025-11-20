/**
 * Unified data models for repository providers (GitLab, GitHub, etc.)
 *
 * These types provide a common interface for working with pull/merge requests,
 * users, commits, and other VCS entities across different platforms.
 */

/**
 * Supported repository provider types
 */
export type ProviderType = 'gitlab' | 'github';

/**
 * Unified representation of a pull/merge request
 *
 * This type abstracts GitLab merge requests and GitHub pull requests
 * into a common structure that can be used throughout the application.
 */
export interface UnifiedPullRequest {
  /** Provider type (gitlab or github) */
  type: ProviderType;

  /** Global unique ID from the provider */
  id: number;

  /** Pull request number (GitLab: iid, GitHub: number) */
  iid: number;

  /** Pull request title */
  title: string;

  /** Pull request description/body */
  description: string;

  /** Current state of the pull request */
  state: 'opened' | 'closed' | 'merged' | 'locked' | 'reopened';

  /** Web URL to view the pull request */
  webUrl: string;

  /** Source branch name */
  sourceBranch: string;

  /** Target/base branch name */
  targetBranch: string;

  /** Pull request author */
  author: UnifiedUser;

  /** Creation timestamp (ISO 8601) */
  createdAt: string;

  /** Last update timestamp (ISO 8601) */
  updatedAt: string;

  /** Merge timestamp (ISO 8601), if merged */
  mergedAt?: string;

  /** Close timestamp (ISO 8601), if closed */
  closedAt?: string;

  /** Whether this is a draft/WIP pull request */
  draft: boolean;

  /** Whether the pull request can be merged */
  mergeable: boolean;

  /** Number of discussions/comments */
  discussionCount: number;

  /** Number of changed files/lines */
  changesCount: number;

  /** Project identifier (GitLab: number, GitHub: "owner/repo") */
  projectId: string | number;

  /** Project path (e.g., "org/repo") */
  projectPath: string;

  /** Labels/tags attached to the pull request */
  labels: string[];

  /** Pipeline/CI status information (if available) */
  pipeline?: UnifiedPipeline;

  /** Original provider-specific data for reference */
  rawData: any;
}

/**
 * Unified representation of a user
 *
 * Abstracts user data from GitLab and GitHub
 */
export interface UnifiedUser {
  /** User ID (GitLab: number, GitHub: string) */
  id: string | number;

  /** Username/login */
  username: string;

  /** Display name */
  name: string;

  /** Avatar image URL */
  avatarUrl?: string;

  /** User profile URL */
  webUrl?: string;
}

/**
 * Unified representation of a commit
 *
 * Abstracts commit data from GitLab and GitHub
 */
export interface UnifiedCommit {
  /** Full commit SHA */
  sha: string;

  /** Short commit SHA (first 7-8 characters) */
  shortSha: string;

  /** Commit title (first line of message) */
  title: string;

  /** Full commit message */
  message: string;

  /** Commit author */
  author: UnifiedUser;

  /** Authored date (ISO 8601) */
  authoredDate: string;

  /** Web URL to view the commit */
  webUrl: string;
}

/**
 * Unified representation of a pipeline/check run
 *
 * Abstracts GitLab pipelines and GitHub Actions/Checks
 */
export interface UnifiedPipeline {
  /** Pipeline/check run ID */
  id: string | number;

  /** Current status */
  status: 'pending' | 'running' | 'success' | 'failed' | 'canceled';

  /** Web URL to view the pipeline/check */
  webUrl: string;

  /** Git ref (branch/tag) the pipeline ran on */
  ref: string;

  /** Creation timestamp (ISO 8601) */
  createdAt: string;

  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/**
 * Unified representation of a project/repository
 *
 * Abstracts GitLab projects and GitHub repositories
 */
export interface UnifiedProject {
  /** Project ID (GitLab: number, GitHub: "owner/repo") */
  id: string | number;

  /** Repository name */
  name: string;

  /** Repository path (last segment) */
  path: string;

  /** Full path with namespace (e.g., "org/repo") */
  pathWithNamespace: string;

  /** Web URL to view the project */
  webUrl: string;

  /** Default branch name (usually "main" or "master") */
  defaultBranch: string;
}

/**
 * Unified representation of approval information
 *
 * Abstracts GitLab approval rules and GitHub review requirements
 */
export interface UnifiedApprovalInfo {
  /** List of users who have approved */
  approvers: UnifiedUser[];

  /** Number of approvals required */
  approvalsRequired: number;

  /** Number of approvals still needed */
  approvalsLeft: number;
}

/**
 * Unified webhook event
 *
 * Represents a webhook event from any provider
 */
export interface WebhookEvent {
  /** Event type */
  type: 'pull_request' | 'note' | 'push' | 'deployment' | 'unknown';

  /** Action that triggered the event (e.g., "opened", "updated", "merged") */
  action?: string;

  /** Pull request data (if type is 'pull_request') */
  pullRequest?: UnifiedPullRequest;

  /** Comment data (if type is 'note') */
  comment?: {
    body: string;
    author: UnifiedUser;
    createdAt: string;
  };

  /** Commits (if type is 'push') */
  commits?: UnifiedCommit[];

  /** Git ref (if type is 'push') */
  ref?: string;

  /** Project ID where the event occurred */
  projectId: string | number;

  /** Original provider-specific payload */
  rawPayload?: any;
}
