import { generateGithubChangelog } from '@/changelog/utils/generateGithubChangelog';
import { CONFIG } from '@/config';
import {
  cancelWorkflowRun,
  createRelease,
  fetchCheckRuns,
  fetchReleaseByTagName,
  fetchReleases,
  hasTag,
  updateRelease,
  fetchCombinedStatus,
  fetchOpenPullRequestsByBranch,
  fetchPullRequest,
  fetchPullRequestCommits,
  fetchPullRequestByName,
  fetchPullRequestReviews,
  fetchRepositoryById,
  fetchRepositoryByName,
  fetchRequiredApprovals,
  fetchTags,
  fetchUserById,
  fetchUserByLogin,
  fetchWorkflowRuns,
  GithubApiError,
  rerunWorkflowRun,
  searchOpenPullRequests,
  searchRepositories,
  updatePullRequestBranch,
} from '@/core/services/github';
import {
  fetchSlackUserFromEmails,
  fetchSlackUserFromGitUser,
  fetchSlackUserFromId,
} from '@/core/services/slack';
import type {
  GithubCheckRun,
  GithubCombinedStatus,
  GithubPullRequest,
  GithubRelease,
  GithubRepository,
  GithubReview,
  GithubUser,
  GithubWorkflowRun,
} from '@/core/typings/GithubModels';
import type { GitlabCommit } from '@/core/typings/GitlabCommit';
import type { RepositoryProvider } from '@/core/typings/RepositoryProvider';
import type { SlackUser } from '@/core/typings/SlackUser';
import type {
  UnifiedApprovalInfo,
  UnifiedPipeline,
  UnifiedProject,
  UnifiedPullRequest,
  UnifiedRelease,
  UnifiedTag,
  UnifiedUser,
} from '@/core/typings/UnifiedModels';

const REPOSITORY_NAME_REGEX = /^[\w.-]+\/[\w.-]+$/;
const PULL_REQUEST_NUMBER_REGEX = /^[#!]?\d+$/;
// Building a review message fetches the same pull request several times.
// Webhooks clear the entry, so a short TTL only absorbs these duplicates.
const PULL_REQUEST_CACHE_TTL_MS = 2000;

/** GitHub login to email, used when logins do not match emails. */
export type GithubUsersMapping = Record<string, string>;

export class GitHubProvider implements RepositoryProvider {
  readonly type = 'github' as const;

  private readonly usersMapping: Map<string, string>;
  private readonly publicEmails = new Map<string, string | null>();
  private readonly pullRequests = new Map<
    string,
    { expiresAt: number; promise: Promise<GithubPullRequest> }
  >();

  constructor(usersMapping: GithubUsersMapping = {}) {
    this.usersMapping = new Map(
      Object.entries(usersMapping).map(([login, email]) => [
        login.toLowerCase(),
        email,
      ]),
    );
  }

  async fetchProject(projectId: number): Promise<UnifiedProject> {
    return toUnifiedProject(await fetchRepositoryById(projectId));
  }

  async searchProjects(query: string): Promise<UnifiedProject[]> {
    const name = getRepositoryName(query);

    if (name !== undefined) {
      try {
        return [toUnifiedProject(await fetchRepositoryByName(name))];
      } catch (error) {
        if (error instanceof GithubApiError && error.status === 404) {
          return [];
        }
        throw error;
      }
    }
    return (await searchRepositories(query)).map(toUnifiedProject);
  }

  getWebhookSettingsUrl(project: Pick<UnifiedProject, 'path'>): string {
    return `${CONFIG.github.url}/${project.path}/settings/hooks`;
  }

  async fetchPullRequest(
    projectId: number,
    iid: number,
  ): Promise<UnifiedPullRequest> {
    const pullRequest = await this.getPullRequest(projectId, iid);
    const [checkRuns, combinedStatus] = await Promise.all([
      fetchCheckRuns(projectId, pullRequest.head.sha).catch(() => []),
      fetchCombinedStatus(projectId, pullRequest.head.sha).catch(
        () => undefined,
      ),
    ]);

    return {
      ...toUnifiedPullRequest(pullRequest, projectId),
      pipelineStatus: getPipelineStatus(checkRuns, combinedStatus),
    };
  }

  async searchPullRequests(
    query: string,
    projectIds: number[],
  ): Promise<UnifiedPullRequest[]> {
    let pullRequests: (UnifiedPullRequest | undefined)[];

    if (PULL_REQUEST_NUMBER_REGEX.test(query)) {
      const number = parseInt(query.replace(/^[#!]/, ''), 10);
      pullRequests = await Promise.all(
        projectIds.map(async (projectId) =>
          ignoreNotFound(
            fetchPullRequest(projectId, number).then((pullRequest) =>
              toUnifiedPullRequest(pullRequest, projectId),
            ),
          ),
        ),
      );
    } else if (query.startsWith(`${CONFIG.github.url}/`)) {
      const [owner, repo, type, number] = new URL(query).pathname
        .split('/')
        .filter(Boolean);

      pullRequests =
        type === 'pull' && number
          ? [
              await ignoreNotFound(
                fetchPullRequestByName(
                  `${owner}/${repo}`,
                  parseInt(number, 10),
                ).then((pullRequest) => toUnifiedPullRequest(pullRequest)),
              ),
            ]
          : [];
    } else {
      const results = await searchOpenPullRequests(query, projectIds);
      pullRequests = await Promise.all(
        results.map(({ number, repositoryName }) =>
          fetchPullRequestByName(repositoryName, number).then((pullRequest) =>
            toUnifiedPullRequest(pullRequest),
          ),
        ),
      );
    }

    return pullRequests.filter(
      (pullRequest): pullRequest is UnifiedPullRequest =>
        pullRequest?.state === 'opened',
    );
  }

  async fetchOpenPullRequestsByBranch(
    projectId: number,
    branchName: string,
  ): Promise<UnifiedPullRequest[]> {
    return (await fetchOpenPullRequestsByBranch(projectId, branchName)).map(
      (pullRequest) => toUnifiedPullRequest(pullRequest, projectId),
    );
  }

  async fetchPullRequestCommitIds(
    projectId: number,
    iid: number,
  ): Promise<string[]> {
    return (await fetchPullRequestCommits(projectId, iid)).map(
      ({ sha }) => sha,
    );
  }

  /**
   * GitLab's "mergeable" label means "only approvals are missing". GitHub
   * computes `mergeable_state` asynchronously, so it is read from the API.
   */
  async isWaitingForApprovals(
    projectId: number,
    iid: number,
  ): Promise<boolean> {
    const { mergeable, mergeable_state } = await fetchPullRequest(
      projectId,
      iid,
    );
    return (
      mergeable !== false &&
      ['blocked', 'clean', 'has_hooks', 'unstable'].includes(
        mergeable_state ?? '',
      )
    );
  }

  async fetchApprovalInfo(
    projectId: number,
    iid: number,
  ): Promise<UnifiedApprovalInfo> {
    const pullRequest = await this.getPullRequest(projectId, iid);
    const [reviews, approvalsRequired] = await Promise.all([
      fetchPullRequestReviews(projectId, iid),
      fetchRequiredApprovals(projectId, pullRequest.base.ref),
    ]);
    const approvers = getLatestReviews(reviews)
      .filter(({ state }) => state === 'APPROVED')
      .map(({ user }) => toUnifiedUser(user!));

    return {
      approvers,
      approvalsRequired,
      approvalsLeft: Math.max(0, approvalsRequired - approvers.length),
    };
  }

  /** Requested reviewers have not reviewed since the request. */
  async fetchPendingReviewerUsernames(
    projectId: number,
    iid: number,
  ): Promise<string[]> {
    const { requested_reviewers } = await this.getPullRequest(projectId, iid);
    return requested_reviewers.map(({ login }) => login);
  }

  /** Requested reviewers and users who already reviewed. */
  async fetchReviewers(projectId: number, iid: number): Promise<UnifiedUser[]> {
    const [pullRequest, reviews] = await Promise.all([
      this.getPullRequest(projectId, iid),
      fetchPullRequestReviews(projectId, iid),
    ]);
    const reviewers = new Map<number, GithubUser>();

    for (const user of [
      ...pullRequest.requested_reviewers,
      ...reviews.map((review) => review.user),
    ]) {
      if (user && user.id !== pullRequest.user.id) {
        reviewers.set(user.id, user);
      }
    }
    return [...reviewers.values()].map(toUnifiedUser);
  }

  async fetchUser(userId: number): Promise<UnifiedUser | undefined> {
    return ignoreNotFound(fetchUserById(userId).then(toUnifiedUser));
  }

  /**
   * GitHub Actions cannot start every workflow of a branch on demand, so the
   * latest run of each workflow on the branch head is re-run. `autoDeploy` has
   * no equivalent and is ignored.
   */
  async runPipeline(projectId: number, branchName: string): Promise<void> {
    const runs = await fetchWorkflowRuns(projectId, { branch: branchName });
    const headSha = runs[0]?.head_sha;
    const latestRunByWorkflow = new Map<number, number>();

    // Runs are sorted from the newest.
    for (const run of runs) {
      if (
        run.head_sha === headSha &&
        !latestRunByWorkflow.has(run.workflow_id)
      ) {
        latestRunByWorkflow.set(run.workflow_id, run.id);
      }
    }

    if (latestRunByWorkflow.size === 0) {
      throw new Error(
        `No workflow run to re-run on branch ${branchName} of repository ${projectId}`,
      );
    }

    await Promise.all(
      [...latestRunByWorkflow.values()].map((runId) =>
        rerunWorkflowRun(projectId, runId),
      ),
    );
  }

  /** GitHub merges the base branch into the pull request branch. */
  async rebasePullRequest(projectId: number, iid: number): Promise<void> {
    await updatePullRequestBranch(projectId, iid);
  }

  /**
   * Tries, in order: `config/homer/githubUsers.json`, the user identity
   * resolvers (`USER_IDENTITY_RESOLVERS`), then the public email of the GitHub
   * profile, which GitHub verifies.
   */
  async findSlackUser(user: UnifiedUser): Promise<SlackUser | undefined> {
    const login = user.username;
    const mappedEmail = this.usersMapping.get(login.toLowerCase());

    if (mappedEmail !== undefined) {
      return fetchSlackUserFromEmails([mappedEmail]);
    }

    const slackUser = await fetchSlackUserFromGitUser({
      provider: 'github',
      username: login,
    });
    if (slackUser !== undefined) {
      return slackUser;
    }

    const publicEmail = user.email ?? (await this.fetchPublicEmail(login));
    return publicEmail ? fetchSlackUserFromEmails([publicEmail]) : undefined;
  }

  /** Only `githubUsers.json` knows GitHub logins from Slack users. */
  async findGitUsername(slackUserId: string): Promise<string | undefined> {
    let email: string | undefined;

    try {
      email = (await fetchSlackUserFromId(slackUserId))?.profile?.email;
    } catch {
      return undefined;
    }
    if (email === undefined) {
      return undefined;
    }
    return [...this.usersMapping].find(
      ([, mappedEmail]) => mappedEmail.toLowerCase() === email.toLowerCase(),
    )?.[0];
  }

  /** Called when GitHub notifies a change, so the next read is fresh. */
  forgetPullRequest(projectId?: number, iid?: number): void {
    if (projectId === undefined || iid === undefined) {
      this.pullRequests.clear();
    } else {
      this.pullRequests.delete(`${projectId}#${iid}`);
    }
  }

  async fetchTags(projectId: number): Promise<UnifiedTag[]> {
    return fetchTags(projectId);
  }

  async hasTag(projectId: number, tagName: string): Promise<boolean> {
    return hasTag(projectId, tagName);
  }

  async fetchReleases(projectId: number): Promise<UnifiedRelease[]> {
    return (await fetchReleases(projectId)).map(toUnifiedRelease);
  }

  async generateChangelog(
    projectId: number,
    previousReleaseTagName: string | undefined,
    filter: (commit: GitlabCommit) => boolean,
  ): Promise<string> {
    return generateGithubChangelog(projectId, previousReleaseTagName, filter);
  }

  /** Latest workflow run of the branch: one commit has one run per workflow. */
  async fetchBranchLastPipeline(
    projectId: number,
    branchName: string,
  ): Promise<UnifiedPipeline> {
    const lastRun = (
      await fetchWorkflowRuns(projectId, { branch: branchName })
    ).find(
      ({ conclusion, event }) =>
        conclusion !== 'cancelled' && event !== 'schedule',
    );

    if (lastRun === undefined) {
      throw new Error(
        `Unable to find a non cancelled ${branchName} workflow run`,
      );
    }
    return toUnifiedPipeline(lastRun);
  }

  /** Workflow runs triggered by a branch or a tag, newest first. */
  async fetchPipelinesByRef(
    projectId: number,
    ref: string,
  ): Promise<UnifiedPipeline[]> {
    return (await fetchWorkflowRuns(projectId, { branch: ref })).map(
      toUnifiedPipeline,
    );
  }

  async cancelPipeline(projectId: number, pipelineId: number): Promise<void> {
    await cancelWorkflowRun(projectId, pipelineId);
  }

  async createRelease(
    projectId: number,
    commitId: string,
    tagName: string,
    description: string,
  ): Promise<void> {
    await createRelease(projectId, commitId, tagName, description);
  }

  async fetchRelease(
    projectId: number,
    tagName: string,
  ): Promise<UnifiedRelease> {
    return toUnifiedRelease(await fetchReleaseByTagName(projectId, tagName));
  }

  async updateReleaseName(
    projectId: number,
    tagName: string,
    name: string,
  ): Promise<void> {
    const { id } = await fetchReleaseByTagName(projectId, tagName);
    await updateRelease(projectId, id, { name });
  }

  getReleaseUrl(
    project: Pick<UnifiedProject, 'webUrl'>,
    tagName: string,
  ): string {
    return `${project.webUrl}/releases/tag/${encodeURIComponent(tagName)}`;
  }

  private getPullRequest(
    projectId: number,
    iid: number,
  ): Promise<GithubPullRequest> {
    const key = `${projectId}#${iid}`;
    const cached = this.pullRequests.get(key);

    if (cached !== undefined && cached.expiresAt > Date.now()) {
      return cached.promise;
    }

    const promise = fetchPullRequest(projectId, iid);
    this.pullRequests.set(key, {
      expiresAt: Date.now() + PULL_REQUEST_CACHE_TTL_MS,
      promise,
    });
    promise.catch(() => this.pullRequests.delete(key));
    return promise;
  }

  private async fetchPublicEmail(login: string): Promise<string | undefined> {
    if (!this.publicEmails.has(login)) {
      try {
        this.publicEmails.set(
          login,
          (await fetchUserByLogin(login)).email ?? null,
        );
      } catch {
        this.publicEmails.set(login, null);
      }
    }
    return this.publicEmails.get(login) ?? undefined;
  }
}

async function ignoreNotFound<T>(promise: Promise<T>): Promise<T | undefined> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof GithubApiError && error.status === 404) {
      return undefined;
    }
    throw error;
  }
}

/** Keeps the last review that counts for each user. */
function getLatestReviews(reviews: GithubReview[]): GithubReview[] {
  const latestReviews = new Map<number, GithubReview>();

  for (const review of reviews) {
    if (
      review.user &&
      ['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)
    ) {
      latestReviews.set(review.user.id, review);
    }
  }
  return [...latestReviews.values()];
}

/**
 * Merges check runs and commit statuses into GitLab pipeline statuses.
 */
function getPipelineStatus(
  checkRuns: GithubCheckRun[],
  combinedStatus: GithubCombinedStatus | undefined,
): string | undefined {
  const statuses: string[] = checkRuns.map(({ conclusion, status }) => {
    if (status !== 'completed') return 'running';
    switch (conclusion) {
      case 'success':
      case 'neutral':
        return 'success';
      case 'skipped':
        return 'skipped';
      case 'cancelled':
        return 'canceled';
      case 'action_required':
        return 'manual';
      default:
        return 'failed';
    }
  });

  if (combinedStatus !== undefined && combinedStatus.total_count > 0) {
    statuses.push(
      combinedStatus.state === 'pending'
        ? 'running'
        : combinedStatus.state === 'success'
          ? 'success'
          : 'failed',
    );
  }

  const priority = ['failed', 'canceled', 'manual', 'running', 'success'];
  const status = priority.find((candidate) => statuses.includes(candidate));
  return status ?? (statuses.length > 0 ? 'skipped' : undefined);
}

function toUnifiedRelease(release: GithubRelease): UnifiedRelease {
  return {
    tagName: release.tag_name,
    name: release.name || release.tag_name,
    description: release.body ?? '',
    releasedAt: release.published_at ?? release.created_at,
  };
}

function toUnifiedPipeline({
  head_sha,
  html_url,
  id,
}: GithubWorkflowRun): UnifiedPipeline {
  return { id, sha: head_sha, webUrl: html_url };
}

function toUnifiedPullRequest(
  pullRequest: GithubPullRequest,
  projectId = pullRequest.base.repo?.id,
): UnifiedPullRequest {
  if (projectId === undefined) {
    throw new Error(`Unable to find the repository of ${pullRequest.html_url}`);
  }

  let state: UnifiedPullRequest['state'] = 'opened';
  if (pullRequest.merged || pullRequest.merged_at) {
    state = 'merged';
  } else if (pullRequest.state === 'closed') {
    state = 'closed';
  }

  return {
    provider: 'github',
    projectId,
    iid: pullRequest.number,
    title: pullRequest.title,
    webUrl: pullRequest.html_url,
    state,
    sourceBranch: pullRequest.head.ref,
    targetBranch: pullRequest.base.ref,
    author: toUnifiedUser(pullRequest.user),
    assignees: (pullRequest.assignees ?? []).map(toUnifiedUser),
    discussionsCount:
      (pullRequest.comments ?? 0) + (pullRequest.review_comments ?? 0),
    changesCount: `${pullRequest.changed_files ?? ''}`,
    mergeable: pullRequest.mergeable === true,
  };
}

/**
 * Extracts `owner/repo` from a repository name or URL.
 */
function getRepositoryName(query: string): string | undefined {
  if (query.startsWith(CONFIG.github.url)) {
    const name = new URL(query).pathname.split('/').filter(Boolean).slice(0, 2);
    return name.length === 2 ? name.join('/') : undefined;
  }
  return REPOSITORY_NAME_REGEX.test(query) ? query : undefined;
}

export function toUnifiedUser(user: GithubUser): UnifiedUser {
  return {
    id: user.id,
    username: user.login,
    name: user.name || user.login,
    webUrl: user.html_url,
    email: user.email || undefined,
  };
}

function toUnifiedProject(repository: GithubRepository): UnifiedProject {
  return {
    provider: 'github',
    id: repository.id,
    path: repository.full_name,
    webUrl: repository.html_url,
    defaultBranch: repository.default_branch,
  };
}
