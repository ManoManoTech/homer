import type { ProviderType } from './Provider';
import type { SlackUser } from './SlackUser';
import type {
  UnifiedApprovalInfo,
  UnifiedProject,
  UnifiedPullRequest,
  UnifiedUser,
} from './UnifiedModels';

/**
 * Operations Homer needs from a git hosting provider for projects and reviews.
 */
export interface RepositoryProvider {
  readonly type: ProviderType;

  fetchProject(projectId: number): Promise<UnifiedProject>;
  /** Accepts free text, a project path or a project URL. */
  searchProjects(query: string): Promise<UnifiedProject[]>;
  /** Returns the URL where users configure the project webhook. */
  getWebhookSettingsUrl(project: Pick<UnifiedProject, 'path'>): string;

  fetchPullRequest(projectId: number, iid: number): Promise<UnifiedPullRequest>;
  /** Accepts free text, a number (`!12`, `#12`, `12`) or a URL. */
  searchPullRequests(
    query: string,
    projectIds: number[],
  ): Promise<UnifiedPullRequest[]>;
  fetchOpenPullRequestsByBranch(
    projectId: number,
    branchName: string,
  ): Promise<UnifiedPullRequest[]>;
  fetchPullRequestCommitIds(projectId: number, iid: number): Promise<string[]>;
  fetchApprovalInfo(
    projectId: number,
    iid: number,
  ): Promise<UnifiedApprovalInfo>;
  fetchReviewers(projectId: number, iid: number): Promise<UnifiedUser[]>;
  /** Usernames of the reviewers who have not reviewed yet. */
  fetchPendingReviewerUsernames(
    projectId: number,
    iid: number,
  ): Promise<string[]>;
  fetchUser(userId: number): Promise<UnifiedUser | undefined>;

  /** `autoDeploy` is the platform to deploy, when the provider supports it. */
  runPipeline(
    projectId: number,
    branchName: string,
    autoDeploy?: string,
  ): Promise<void>;
  /** Brings the source branch up to date with the target branch. */
  rebasePullRequest(projectId: number, iid: number): Promise<void>;

  findSlackUser(user: UnifiedUser): Promise<SlackUser | undefined>;
  /** Reverse of `findSlackUser`, used to personalize the review list. */
  findGitUsername(slackUserId: string): Promise<string | undefined>;
}
