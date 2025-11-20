/**
 * GitLab Repository Provider
 *
 * Implements the RepositoryProvider interface for GitLab.
 * Wraps existing GitLab service functions and transforms data
 * to unified models.
 */

import { MERGE_REQUEST_OPEN_STATES } from '@/constants';
import * as gitlab from '@/core/services/gitlab';
import type { GitlabCommit } from '@/core/typings/GitlabCommit';
import type {
  GitlabMergeRequest,
  GitlabMergeRequestDetails,
} from '@/core/typings/GitlabMergeRequest';
import type { GitlabPipeline } from '@/core/typings/GitlabPipeline';
import type { GitlabProject } from '@/core/typings/GitlabProject';
import type { GitlabUser } from '@/core/typings/GitlabUser';
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
 * GitLab provider implementation
 */
export class GitLabProvider implements RepositoryProvider {
  readonly type = 'gitlab' as const;

  // Note: baseUrl and token are stored for potential future use
  // (e.g., if we switch from using the global gitlab service to instance-specific calls)

  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  /**
   * Fetch a single merge request and transform to unified format
   */
  async fetchPullRequest(
    projectId: string | number,
    number: number,
  ): Promise<UnifiedPullRequest> {
    const mr = await gitlab.fetchMergeRequestByIid(projectId, number);
    // GitLab API always returns numeric project_id in the response,
    // even when queried by project path. Use it for the transform.
    const numericProjectId =
      typeof mr.project_id === 'number'
        ? mr.project_id
        : parseInt(mr.project_id, 10);
    return this.transformMergeRequest(mr, numericProjectId);
  }

  /**
   * Search for merge requests
   */
  async searchPullRequests(
    projectIds: (string | number)[],
    query: string,
    states?: string[],
  ): Promise<UnifiedPullRequest[]> {
    const searchStates = states || MERGE_REQUEST_OPEN_STATES;
    const numericProjectIds = projectIds.map((id) => id as number);

    // Check if query is MR ID (!123 or 123)
    const idMatch = query.match(/^!?(\d+)$/);
    if (idMatch) {
      const iid = parseInt(idMatch[1], 10);
      return this.searchByIid(numericProjectIds, iid);
    }

    // Check if query is URL
    if (query.includes('merge_requests')) {
      return this.searchByUrl(query, numericProjectIds);
    }

    // Text search across multiple projects
    return this.searchByText(numericProjectIds, query, searchStates);
  }

  /**
   * Search by merge request IID
   */
  private async searchByIid(
    projectIds: number[],
    iid: number,
  ): Promise<UnifiedPullRequest[]> {
    for (const projectId of projectIds) {
      try {
        const mr = await gitlab.fetchMergeRequestByIid(projectId, iid);
        return [this.transformMergeRequest(mr, projectId)];
      } catch {
        // Try next project (MR might not exist in this project)
        continue;
      }
    }
    return [];
  }

  /**
   * Search by GitLab URL
   */
  private async searchByUrl(
    url: string,
    projectIds: number[],
  ): Promise<UnifiedPullRequest[]> {
    // Extract project path and IID from URL
    // Format: https://gitlab.com/org/repo/-/merge_requests/123
    // or https://gitlab.example.com/group/subgroup/project/-/merge_requests/123
    const urlMatch = url.match(
      /^https?:\/\/[^/]+\/(.+)\/-\/merge_requests\/(\d+)/,
    );

    if (!urlMatch) {
      return [];
    }

    const urlProjectPath = urlMatch[1]; // e.g., "qovery/backend/homer"
    const iid = parseInt(urlMatch[2], 10);

    // Find which configured project matches the URL's project path
    const matchingProjectId = await this.findProjectByPath(
      projectIds,
      urlProjectPath,
    );

    if (!matchingProjectId) {
      // No configured project matches the URL path
      return [];
    }

    // Only search the specific project that matches the URL
    return this.searchByIid([matchingProjectId], iid);
  }

  /**
   * Find a project ID by matching its path_with_namespace against a URL path
   */

  private async findProjectByPath(
    projectIds: number[],
    urlPath: string,
  ): Promise<number | null> {
    for (const projectId of projectIds) {
      try {
        const project = await gitlab.fetchProjectById(projectId);
        if (project.path_with_namespace === urlPath) {
          return projectId;
        }
      } catch {
        // Continue checking other projects if one fails
        continue;
      }
    }
    return null;
  }

  /**
   * Search by text query
   */

  private async searchByText(
    projectIds: number[],
    query: string,
    states: string[],
  ): Promise<UnifiedPullRequest[]> {
    const allResults: UnifiedPullRequest[] = [];

    for (const projectId of projectIds) {
      try {
        const mrs = await gitlab.fetchMergeRequestsByText(
          projectId,
          query,
          states,
        );
        const unified = mrs.map((mr) =>
          this.transformMergeRequest(mr, projectId),
        );
        allResults.push(...unified);
      } catch {
        // Continue searching other projects if one fails
        continue;
      }
    }

    return allResults;
  }

  /**
   * Fetch approvers for a merge request
   */
  async fetchApprovers(
    projectId: string | number,
    number: number,
  ): Promise<UnifiedUser[]> {
    const approvalInfo = await gitlab.fetchMergeRequestApprovers(
      projectId as number,
      number,
    );
    return approvalInfo.approvers.map((user) => this.transformUser(user));
  }

  /**
   * Fetch approval information including counts and approvers
   */
  async fetchApprovalInfo(
    projectId: string | number,
    number: number,
  ): Promise<UnifiedApprovalInfo> {
    const approvalInfo = await gitlab.fetchMergeRequestApprovers(
      projectId as number,
      number,
    );
    return {
      approvers: approvalInfo.approvers.map((user) => this.transformUser(user)),
      approvalsRequired: approvalInfo.approvals_required,
      approvalsLeft: approvalInfo.approvals_left,
    };
  }

  /**
   * Fetch reviewers for a merge request
   */
  async fetchReviewers(
    projectId: string | number,
    number: number,
  ): Promise<UnifiedUser[]> {
    const reviewers = await gitlab.fetchReviewers(projectId as number, number);
    return reviewers.map((user) => this.transformUser(user));
  }

  /**
   * Fetch assignees for a merge request
   */
  async fetchAssignees(
    projectId: string | number,
    number: number,
  ): Promise<UnifiedUser[]> {
    const mr = await gitlab.fetchMergeRequestByIid(projectId as number, number);
    return mr.assignees.map((user) => this.transformUser(user));
  }

  /**
   * Fetch user by ID
   */
  async fetchUser(userId: string | number): Promise<UnifiedUser> {
    const user = await gitlab.fetchUserById(userId as number);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    return this.transformUser(user);
  }

  /**
   * Fetch commits for a merge request
   */
  async fetchCommits(
    projectId: string | number,
    number: number,
  ): Promise<UnifiedCommit[]> {
    const commits = await gitlab.fetchMergeRequestCommits(
      projectId as number,
      number,
    );
    return commits.map((commit) => this.transformCommit(commit));
  }

  /**
   * Fetch pipeline status for a ref
   */
  async fetchPipelineStatus(
    projectId: string | number,
    ref: string,
  ): Promise<UnifiedPipeline | null> {
    const pipelines = await gitlab.fetchPipelinesByRef(
      projectId as number,
      ref,
    );

    if (!pipelines || pipelines.length === 0) {
      return null;
    }

    return this.transformPipeline(pipelines[0]);
  }

  /**
   * Trigger a new pipeline
   */

  async triggerPipeline(
    projectId: string | number,
    ref: string,
  ): Promise<void> {
    await gitlab.runPipeline(projectId as number, ref);
  }

  /**
   * Fetch project information
   */
  async fetchProject(projectId: string | number): Promise<UnifiedProject> {
    const project = await gitlab.fetchProjectById(projectId as number);
    return this.transformProject(project);
  }

  /**
   * Rebase a merge request
   */

  async rebasePullRequest(
    projectId: string | number,
    number: number,
  ): Promise<void> {
    await gitlab.rebaseMergeRequest(projectId as number, number);
  }

  /**
   * Validate GitLab webhook signature
   *
   * GitLab uses a simple token comparison (X-Gitlab-Token header)
   */

  validateWebhookSignature(
    payload: Buffer,
    signature: string,
    secret: string,
  ): boolean {
    return signature === secret;
  }

  /**
   * Parse GitLab webhook event
   */
  parseWebhookEvent(
    headers: Record<string, string | string[] | undefined>,
    body: any,
  ): WebhookEvent | null {
    const objectKind = body.object_kind;

    switch (objectKind) {
      case 'merge_request':
        return this.parseMergeRequestWebhook(body);
      case 'note':
        return this.parseNoteWebhook(body);
      case 'push':
        return this.parsePushWebhook(body);
      case 'deployment':
        return this.parseDeploymentWebhook(body);
      default:
        return null;
    }
  }

  /**
   * Parse merge request webhook
   */

  private parseMergeRequestWebhook(body: any): WebhookEvent {
    const action = body.object_attributes?.action;
    const projectId = body.object_attributes?.project_id;

    return {
      type: 'pull_request',
      action,
      projectId,
      rawPayload: body,
    };
  }

  /**
   * Parse note (comment) webhook
   */

  private parseNoteWebhook(body: any): WebhookEvent {
    const projectId = body.project?.id;

    return {
      type: 'note',
      projectId,
      rawPayload: body,
    };
  }

  /**
   * Parse push webhook
   */

  private parsePushWebhook(body: any): WebhookEvent {
    const { ref } = body;
    const projectId = body.project_id;

    return {
      type: 'push',
      ref,
      projectId,
      rawPayload: body,
    };
  }

  /**
   * Parse deployment webhook
   */

  private parseDeploymentWebhook(body: any): WebhookEvent {
    const projectId = body.project?.id;

    return {
      type: 'deployment',
      projectId,
      rawPayload: body,
    };
  }

  /**
   * Transform GitLab merge request to unified format
   */
  private transformMergeRequest(
    mr: GitlabMergeRequest | GitlabMergeRequestDetails,
    projectId: number,
  ): UnifiedPullRequest {
    // Extract pipeline info if available (only in GitlabMergeRequestDetails)
    let pipeline: UnifiedPipeline | undefined;
    if ('head_pipeline' in mr && mr.head_pipeline) {
      // head_pipeline has a simplified structure with only id, status, and web_url
      pipeline = {
        id: mr.head_pipeline.id,
        status: this.mapPipelineStatus(mr.head_pipeline.status),
        webUrl: mr.head_pipeline.web_url,
        ref: mr.source_branch, // Use source branch as ref
        createdAt: mr.created_at, // Use MR created_at as fallback
        updatedAt: mr.updated_at, // Use MR updated_at as fallback
      };
    }

    return {
      type: 'gitlab',
      id: mr.id,
      iid: mr.iid,
      title: mr.title,
      description: mr.description,
      state: this.mapState(mr.state),
      webUrl: mr.web_url,
      sourceBranch: mr.source_branch,
      targetBranch: mr.target_branch,
      author: this.transformUser(mr.author),
      createdAt: mr.created_at,
      updatedAt: mr.updated_at,
      mergedAt: mr.merged_at || undefined,
      closedAt: mr.closed_at || undefined,
      draft: mr.work_in_progress,
      mergeable: mr.merge_status === 'can_be_merged',
      discussionCount: mr.user_notes_count,
      changesCount: this.parseChangesCount(mr),
      projectId,
      projectPath: this.extractProjectPath(mr.references.full),
      labels: mr.labels,
      pipeline,
      rawData: mr,
    };
  }

  /**
   * Parse changes count from string or undefined
   */

  private parseChangesCount(
    mr: GitlabMergeRequest | GitlabMergeRequestDetails,
  ): number {
    if ('changes_count' in mr && mr.changes_count) {
      return parseInt(mr.changes_count, 10);
    }
    return 0;
  }

  /**
   * Extract project path from references.full (e.g., "org/repo!123" -> "org/repo")
   */

  private extractProjectPath(full: string): string {
    return full.split('!')[0];
  }

  /**
   * Map GitLab state to unified state
   */

  private mapState(gitlabState: string): UnifiedPullRequest['state'] {
    const stateMap: Record<string, UnifiedPullRequest['state']> = {
      opened: 'opened',
      closed: 'closed',
      merged: 'merged',
      locked: 'locked',
      reopened: 'reopened',
    };
    return stateMap[gitlabState] || 'opened';
  }

  /**
   * Transform GitLab user to unified format
   */

  private transformUser(user: GitlabUser): UnifiedUser {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      avatarUrl: user.avatar_url || undefined,
      webUrl: user.web_url,
    };
  }

  /**
   * Transform GitLab commit to unified format
   */

  private transformCommit(commit: GitlabCommit): UnifiedCommit {
    return {
      sha: commit.id,
      shortSha: commit.short_id,
      title: commit.title,
      message: commit.message,
      author: {
        id: commit.author_email,
        username: commit.author_name,
        name: commit.author_name,
      },
      authoredDate: commit.authored_date,
      webUrl: commit.web_url,
    };
  }

  /**
   * Transform GitLab pipeline to unified format
   */
  private transformPipeline(pipeline: GitlabPipeline): UnifiedPipeline {
    return {
      id: pipeline.id,
      status: this.mapPipelineStatus(pipeline.status),
      webUrl: pipeline.web_url,
      ref: pipeline.ref,
      createdAt: pipeline.created_at,
      updatedAt: pipeline.updated_at,
    };
  }

  /**
   * Map GitLab pipeline status to unified status
   */

  private mapPipelineStatus(gitlabStatus: string): UnifiedPipeline['status'] {
    const statusMap: Record<string, UnifiedPipeline['status']> = {
      pending: 'pending',
      running: 'running',
      success: 'success',
      failed: 'failed',
      canceled: 'canceled',
      cancelled: 'canceled', // GitLab uses both spellings
      skipped: 'canceled',
      manual: 'pending',
    };
    return statusMap[gitlabStatus] || 'pending';
  }

  /**
   * Transform GitLab project to unified format
   */

  private transformProject(project: GitlabProject): UnifiedProject {
    return {
      id: project.id,
      name: project.name,
      path: project.path,
      pathWithNamespace: project.path_with_namespace,
      webUrl: project.web_url,
      defaultBranch: project.default_branch,
    };
  }
}
