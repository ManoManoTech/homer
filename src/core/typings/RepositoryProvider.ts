import type { GitlabCommit } from './GitlabCommit';
import type { ProviderType } from './Provider';
import type {
  UnifiedApprovalInfo,
  UnifiedPipeline,
  UnifiedProject,
  UnifiedPullRequest,
  UnifiedRelease,
  UnifiedTag,
  UnifiedUser,
} from './UnifiedModels';

/**
 * Operations Homer needs from a git hosting provider for projects, reviews,
 * changelogs and releases.
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

  /** Newest first. */
  fetchTags(projectId: number): Promise<UnifiedTag[]>;
  hasTag(projectId: number, tagName: string): Promise<boolean>;
  /**
   * Markdown list of the changes since `previousReleaseTagName`. The filter
   * receives GitLab shaped commits because release plugins expect them.
   */
  generateChangelog(
    projectId: number,
    previousReleaseTagName: string | undefined,
    filter: (commit: GitlabCommit) => boolean,
  ): Promise<string>;
  /** Last pipeline of the branch, ignoring canceled and scheduled ones. */
  fetchBranchLastPipeline(
    projectId: number,
    branchName: string,
  ): Promise<UnifiedPipeline>;
  /** Newest first. */
  fetchPipelinesByRef(
    projectId: number,
    ref: string,
  ): Promise<UnifiedPipeline[]>;
  cancelPipeline(projectId: number, pipelineId: number): Promise<void>;
  createRelease(
    projectId: number,
    commitId: string,
    tagName: string,
    description: string,
  ): Promise<void>;
  fetchRelease(projectId: number, tagName: string): Promise<UnifiedRelease>;
  fetchReleases(projectId: number): Promise<UnifiedRelease[]>;
  updateReleaseName(
    projectId: number,
    tagName: string,
    name: string,
  ): Promise<void>;
  getReleaseUrl(
    project: Pick<UnifiedProject, 'webUrl'>,
    tagName: string,
  ): string;
}
