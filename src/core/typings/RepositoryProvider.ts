/**
 * Repository Provider Interface
 *
 * This interface defines a common abstraction for interacting with different
 * version control systems (GitLab, GitHub, etc.). It allows Homer to work
 * with pull/merge requests from multiple platforms using a unified API.
 *
 * Providers implement this interface to translate platform-specific operations
 * into the unified data models defined in UnifiedModels.ts.
 */

import type {
  ProviderType,
  UnifiedApprovalInfo,
  UnifiedCommit,
  UnifiedPipeline,
  UnifiedProject,
  UnifiedPullRequest,
  UnifiedUser,
  WebhookEvent,
} from './UnifiedModels';

/**
 * Repository provider interface
 *
 * Implementations: GitLabProvider, GitHubProvider
 */
export interface RepositoryProvider {
  /**
   * Provider type identifier
   */
  readonly type: ProviderType;

  // ==================== Pull/Merge Request Operations ====================

  /**
   * Fetch a single pull/merge request by number
   *
   * @param projectId - Project identifier (GitLab: numeric ID, GitHub: "owner/repo")
   * @param number - Pull request number (GitLab: iid, GitHub: number)
   * @returns Unified pull request data
   * @throws Error if PR not found or access denied
   *
   * @example
   * const pr = await provider.fetchPullRequest(123, 100);
   * const pr = await provider.fetchPullRequest('owner/repo', 42);
   */
  fetchPullRequest(
    projectId: string | number,
    number: number,
  ): Promise<UnifiedPullRequest>;

  /**
   * Search for pull/merge requests across multiple projects
   *
   * @param projectIds - List of project identifiers to search in
   * @param query - Search query (can be text, ID like "!123", or URL)
   * @param states - Optional filter by states (default: open states)
   * @returns Array of matching pull requests
   *
   * @example
   * // Search by text
   * const prs = await provider.searchPullRequests([123, 456], 'fix login bug');
   *
   * // Search by ID
   * const prs = await provider.searchPullRequests([123], '!100');
   *
   * // Search by URL
   * const prs = await provider.searchPullRequests([], 'https://gitlab.com/org/repo/-/merge_requests/100');
   */
  searchPullRequests(
    projectIds: (string | number)[],
    query: string,
    states?: string[],
  ): Promise<UnifiedPullRequest[]>;

  // ==================== User/Participant Operations ====================

  /**
   * Fetch users who approved the pull request
   *
   * @param projectId - Project identifier
   * @param number - Pull request number
   * @returns List of users who approved
   *
   * @example
   * const approvers = await provider.fetchApprovers(123, 100);
   */
  fetchApprovers(
    projectId: string | number,
    number: number,
  ): Promise<UnifiedUser[]>;

  /**
   * Fetch approval information including counts and approvers
   *
   * @param projectId - Project identifier
   * @param number - Pull request number
   * @returns Approval information with counts and approvers
   *
   * @example
   * const approvalInfo = await provider.fetchApprovalInfo(123, 100);
   */
  fetchApprovalInfo(
    projectId: string | number,
    number: number,
  ): Promise<UnifiedApprovalInfo>;

  /**
   * Fetch users who are requested reviewers
   *
   * @param projectId - Project identifier
   * @param number - Pull request number
   * @returns List of requested reviewers
   *
   * @example
   * const reviewers = await provider.fetchReviewers(123, 100);
   */
  fetchReviewers(
    projectId: string | number,
    number: number,
  ): Promise<UnifiedUser[]>;

  /**
   * Fetch users assigned to the pull request
   *
   * @param projectId - Project identifier
   * @param number - Pull request number
   * @returns List of assigned users
   *
   * @example
   * const assignees = await provider.fetchAssignees(123, 100);
   */
  fetchAssignees(
    projectId: string | number,
    number: number,
  ): Promise<UnifiedUser[]>;

  /**
   * Fetch user information by ID
   *
   * @param userId - User identifier
   * @returns User information
   *
   * @example
   * const user = await provider.fetchUser(123);
   * const user = await provider.fetchUser('octocat');
   */
  fetchUser(userId: string | number): Promise<UnifiedUser>;

  // ==================== Commit Operations ====================

  /**
   * Fetch commits for a pull request
   *
   * @param projectId - Project identifier
   * @param number - Pull request number
   * @returns List of commits in the pull request
   *
   * @example
   * const commits = await provider.fetchCommits(123, 100);
   */
  fetchCommits(
    projectId: string | number,
    number: number,
  ): Promise<UnifiedCommit[]>;

  // ==================== Pipeline/Check Operations ====================

  /**
   * Fetch the latest pipeline/check status for a ref
   *
   * @param projectId - Project identifier
   * @param ref - Git ref (branch or tag name)
   * @returns Pipeline/check information, or null if none found
   *
   * @example
   * const pipeline = await provider.fetchPipelineStatus(123, 'main');
   */
  fetchPipelineStatus(
    projectId: string | number,
    ref: string,
  ): Promise<UnifiedPipeline | null>;

  /**
   * Trigger a new pipeline/check run
   *
   * @param projectId - Project identifier
   * @param ref - Git ref (branch or tag name)
   *
   * @example
   * await provider.triggerPipeline(123, 'feature-branch');
   */
  triggerPipeline(projectId: string | number, ref: string): Promise<void>;

  // ==================== Project Operations ====================

  /**
   * Fetch project/repository information
   *
   * @param projectId - Project identifier
   * @returns Project information
   *
   * @example
   * const project = await provider.fetchProject(123);
   * const project = await provider.fetchProject('owner/repo');
   */
  fetchProject(projectId: string | number): Promise<UnifiedProject>;

  // ==================== Actions ====================

  /**
   * Rebase the pull request onto the target branch
   *
   * @param projectId - Project identifier
   * @param number - Pull request number
   *
   * @example
   * await provider.rebasePullRequest(123, 100);
   */
  rebasePullRequest(projectId: string | number, number: number): Promise<void>;

  // ==================== Webhook Operations ====================

  /**
   * Validate webhook signature
   *
   * Verifies that the webhook payload is authentic and came from
   * the VCS platform.
   *
   * @param payload - Raw webhook payload as Buffer
   * @param signature - Signature header from the webhook
   * @param secret - Secret key configured for webhooks
   * @returns true if signature is valid, false otherwise
   *
   * @example
   * // GitLab
   * const isValid = provider.validateWebhookSignature(
   *   req.rawBody,
   *   req.headers['x-gitlab-token'],
   *   process.env.GITLAB_SECRET
   * );
   *
   * // GitHub
   * const isValid = provider.validateWebhookSignature(
   *   req.rawBody,
   *   req.headers['x-hub-signature-256'],
   *   process.env.GITHUB_SECRET
   * );
   */
  validateWebhookSignature(
    payload: Buffer,
    signature: string,
    secret: string,
  ): boolean;

  /**
   * Parse webhook event into unified format
   *
   * Transforms platform-specific webhook payloads into a unified
   * WebhookEvent structure.
   *
   * @param headers - HTTP headers from the webhook request
   * @param body - Parsed webhook body
   * @returns Unified webhook event, or null if event should be ignored
   *
   * @example
   * const event = provider.parseWebhookEvent(req.headers, req.body);
   * if (event && event.type === 'pull_request') {
   *   await handlePullRequestEvent(event);
   * }
   */
  parseWebhookEvent(
    headers: Record<string, string | string[] | undefined>,
    body: any,
  ): WebhookEvent | null;
}
