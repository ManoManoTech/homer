/**
 * GitHub Repository Provider
 *
 * Implements the RepositoryProvider interface for GitHub.
 * Wraps GitHub API service functions and transforms data
 * to unified models.
 */

import crypto from 'crypto';
import * as github from '@/core/services/github';
import type { GitHubPullRequest } from '@/core/typings/GitHubPullRequest';
import type { GitHubRepository } from '@/core/typings/GitHubRepository';
import type { GitHubUser } from '@/core/typings/GitHubUser';
import type { RepositoryProvider } from '@/core/typings/RepositoryProvider';
import type {
  UnifiedApprovalInfo,
  UnifiedCommit,
  UnifiedPipeline,
  UnifiedProject,
  UnifiedPullRequest,
  UnifiedUser,
  WebhookEvent,
} from '@/core/typings/UnifiedModels';

/**
 * GitHub provider implementation
 */
export class GitHubProvider implements RepositoryProvider {
  readonly type = 'github' as const;

  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  /**
   * Fetch a single pull request and transform to unified format
   */
  async fetchPullRequest(
    projectId: string | number,
    number: number,
  ): Promise<UnifiedPullRequest> {
    const pr = await github.fetchPullRequest(projectId as string, number);
    return this.transformPullRequest(pr, projectId as string);
  }

  /**
   * Search for pull requests
   */
  async searchPullRequests(
    projectIds: (string | number)[],
    query: string,
  ): Promise<UnifiedPullRequest[]> {
    // Check if query is PR number (#42 or 42)
    const numberMatch = query.match(/^#?(\d+)$/);
    if (numberMatch) {
      const prNumber = parseInt(numberMatch[1], 10);
      return this.searchByNumber(projectIds as string[], prNumber);
    }

    // Check if query is GitHub URL
    if (query.includes('github.com') && query.includes('/pull/')) {
      return this.searchByUrl(query);
    }

    // Text search not implemented for GitHub (would require Search API)
    // For now, return empty results
    return [];
  }

  /**
   * Search by PR number across projects
   */
  private async searchByNumber(
    repoNames: string[],
    prNumber: number,
  ): Promise<UnifiedPullRequest[]> {
    for (const repoName of repoNames) {
      try {
        const pr = await github.fetchPullRequest(repoName, prNumber);
        return [this.transformPullRequest(pr, repoName)];
      } catch {
        // Try next repo
        continue;
      }
    }
    return [];
  }

  /**
   * Search by GitHub URL
   */
  private async searchByUrl(url: string): Promise<UnifiedPullRequest[]> {
    // Extract owner/repo and PR number from URL
    // Format: https://github.com/owner/repo/pull/42
    const urlMatch = url.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);

    if (!urlMatch) {
      return [];
    }

    const repoFullName = urlMatch[1];
    const prNumber = parseInt(urlMatch[2], 10);

    try {
      const pr = await github.fetchPullRequest(repoFullName, prNumber);
      return [this.transformPullRequest(pr, repoFullName)];
    } catch {
      return [];
    }
  }

  /**
   * Fetch approvers for a pull request
   * GitHub uses reviews with state 'APPROVED'
   */
  async fetchApprovers(
    projectId: string | number,
    number: number,
  ): Promise<UnifiedUser[]> {
    const reviews = await github.fetchPullRequestReviews(
      projectId as string,
      number,
    );

    // Filter for approved reviews and get unique users
    const approvedReviews = reviews.filter(
      (review) => review.state === 'APPROVED',
    );

    // Deduplicate by user ID (a user can approve multiple times)
    const uniqueUsers = new Map<number, UnifiedUser>();
    approvedReviews.forEach((review) => {
      if (!uniqueUsers.has(review.user.id)) {
        uniqueUsers.set(review.user.id, this.transformUser(review.user));
      }
    });

    return Array.from(uniqueUsers.values());
  }

  /**
   * Fetch approval information including counts and approvers
   * GitHub doesn't have explicit approval requirements, so we return 0/0
   */
  async fetchApprovalInfo(
    projectId: string | number,
    number: number,
  ): Promise<UnifiedApprovalInfo> {
    const approvers = await this.fetchApprovers(projectId, number);

    // GitHub doesn't have a required approvals count like GitLab
    // Return 0/0 to indicate no requirements
    return {
      approvers,
      approvalsRequired: 0,
      approvalsLeft: 0,
    };
  }

  /**
   * Fetch reviewers for a pull request
   * GitHub has requested_reviewers endpoint
   */
  async fetchReviewers(
    projectId: string | number,
    number: number,
  ): Promise<UnifiedUser[]> {
    const reviewers = await github.fetchRequestedReviewers(
      projectId as string,
      number,
    );
    return reviewers.map((user) => this.transformUser(user));
  }

  /**
   * Fetch assignees for a pull request
   */
  async fetchAssignees(
    projectId: string | number,
    number: number,
  ): Promise<UnifiedUser[]> {
    const assignees = await github.fetchPullRequestAssignees(
      projectId as string,
      number,
    );
    return assignees.map((user) => this.transformUser(user));
  }

  /**
   * Fetch user by ID
   */
  async fetchUser(userId: string | number): Promise<UnifiedUser> {
    const user = await github.fetchUser(userId as number);
    return this.transformUser(user);
  }

  /**
   * Fetch commits for a pull request
   * TODO: Implement in Part 2
   */
  async fetchCommits(
    _projectId: string | number,
    _number: number,
  ): Promise<UnifiedCommit[]> {
    throw new Error('Not implemented yet');
  }

  /**
   * Fetch pipeline status for a ref
   * TODO: Implement in Part 2
   */
  async fetchPipelineStatus(
    _projectId: string | number,
    _ref: string,
  ): Promise<UnifiedPipeline | null> {
    throw new Error('Not implemented yet');
  }

  /**
   * Trigger a new pipeline
   * TODO: Implement in Part 2
   */
  async triggerPipeline(
    _projectId: string | number,
    _ref: string,
  ): Promise<void> {
    throw new Error('Not implemented yet');
  }

  /**
   * Fetch project information
   */
  async fetchProject(projectId: string | number): Promise<UnifiedProject> {
    const repo = await github.fetchRepository(projectId as string);
    return this.transformRepository(repo);
  }

  /**
   * Rebase a pull request
   * GitHub doesn't have a rebase API, so this is not supported
   */
  async rebasePullRequest(
    _projectId: string | number,
    _number: number,
  ): Promise<void> {
    throw new Error('Rebase is not supported for GitHub pull requests');
  }

  /**
   * Validate GitHub webhook signature
   * GitHub uses HMAC SHA-256
   */

  validateWebhookSignature(
    payload: Buffer,
    signature: string,
    secret: string,
  ): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload.toString('utf8'));
    const expectedSignature = `sha256=${hmac.digest('hex')}`;
    return signature === expectedSignature;
  }

  /**
   * Parse GitHub webhook event
   */

  parseWebhookEvent(
    headers: Record<string, string | string[] | undefined>,
    body: any,
  ): WebhookEvent | null {
    const eventType = headers['x-github-event'] as string;

    switch (eventType) {
      case 'pull_request':
        return this.parsePullRequestWebhook(body);
      case 'issue_comment':
        // GitHub sends PR comments as issue_comment events
        if (body.issue?.pull_request) {
          return this.parseCommentWebhook(body);
        }
        return null;
      case 'pull_request_review':
        return this.parsePullRequestReviewWebhook(body);
      default:
        return null;
    }
  }

  /**
   * Parse pull request webhook
   */

  private parsePullRequestWebhook(body: any): WebhookEvent {
    const { action } = body; // opened, closed, synchronize, etc.
    const { repository } = body;
    const repoFullName = repository?.full_name;

    return {
      type: 'pull_request',
      action,
      projectId: repoFullName,
      rawPayload: body,
    };
  }

  /**
   * Parse comment webhook
   */

  private parseCommentWebhook(body: any): WebhookEvent {
    const repoFullName = body.repository?.full_name;

    return {
      type: 'note',
      projectId: repoFullName,
      rawPayload: body,
    };
  }

  /**
   * Parse pull request review webhook
   */

  private parsePullRequestReviewWebhook(body: any): WebhookEvent {
    const { action, repository } = body;
    const repoFullName = repository?.full_name;

    return {
      type: 'pull_request',
      action: `review_${action}`,
      projectId: repoFullName,
      rawPayload: body,
    };
  }

  /**
   * Transform GitHub pull request to unified format
   */
  private transformPullRequest(
    pr: GitHubPullRequest,
    repoFullName: string,
  ): UnifiedPullRequest {
    return {
      type: 'github',
      id: pr.id,
      iid: pr.number,
      title: pr.title,
      description: pr.body || '',
      state: this.mapState(pr),
      webUrl: pr.html_url,
      sourceBranch: pr.head.ref,
      targetBranch: pr.base.ref,
      author: this.transformUser(pr.user),
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      mergedAt: pr.merged_at || undefined,
      closedAt: pr.closed_at || undefined,
      draft: pr.draft,
      mergeable: pr.mergeable ?? false,
      discussionCount: pr.comments,
      changesCount: pr.changed_files,
      projectId: repoFullName,
      projectPath: repoFullName,
      labels: pr.labels.map((label) => label.name),
      rawData: pr,
    };
  }

  /**
   * Map GitHub state to unified state
   */

  private mapState(pr: GitHubPullRequest): UnifiedPullRequest['state'] {
    if (pr.merged) {
      return 'merged';
    }
    if (pr.state === 'closed') {
      return 'closed';
    }
    return 'opened';
  }

  /**
   * Transform GitHub user to unified format
   */

  private transformUser(user: GitHubUser): UnifiedUser {
    return {
      id: user.id,
      username: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
      webUrl: user.html_url,
    };
  }

  /**
   * Transform GitHub repository to unified format
   */

  private transformRepository(repo: GitHubRepository): UnifiedProject {
    return {
      id: repo.full_name,
      name: repo.name,
      path: repo.name,
      pathWithNamespace: repo.full_name,
      webUrl: repo.html_url,
      defaultBranch: repo.default_branch,
    };
  }
}
