import { CONFIG } from '@/config';
import {
  fetchMergeRequestApprovers,
  fetchMergeRequestByIid,
  fetchMergeRequestCommits,
  fetchMergeRequestReviewers,
  fetchMergeRequestsByBranchName,
  fetchProjectById,
  fetchReviewers,
  fetchUserById,
  rebaseMergeRequest,
  runPipeline,
  searchMergeRequests,
  searchProjects,
} from '@/core/services/gitlab';
import {
  fetchGitlabUsernameFromSlackUserId,
  fetchSlackUserFromGitlabUsername,
} from '@/core/services/slack';
import type { GitlabCiVariable } from '@/core/typings/GitlabCiVariable';
import type {
  GitlabMergeRequest,
  GitlabMergeRequestDetails,
  GitlabMergeRequestState,
} from '@/core/typings/GitlabMergeRequest';
import type { GitlabProject } from '@/core/typings/GitlabProject';
import type { GitlabUser, GitlabUserDetails } from '@/core/typings/GitlabUser';
import type { RepositoryProvider } from '@/core/typings/RepositoryProvider';
import type { SlackUser } from '@/core/typings/SlackUser';
import type {
  UnifiedApprovalInfo,
  UnifiedProject,
  UnifiedPullRequest,
  UnifiedPullRequestState,
  UnifiedUser,
} from '@/core/typings/UnifiedModels';

export class GitLabProvider implements RepositoryProvider {
  readonly type = 'gitlab' as const;

  async fetchProject(projectId: number): Promise<UnifiedProject> {
    return toUnifiedProject(await fetchProjectById(projectId));
  }

  async searchProjects(query: string): Promise<UnifiedProject[]> {
    return (await searchProjects(query)).map(toUnifiedProject);
  }

  getWebhookSettingsUrl(project: Pick<UnifiedProject, 'path'>): string {
    return `${CONFIG.gitlab.url}/${project.path}/-/hooks`;
  }

  async fetchPullRequest(
    projectId: number,
    iid: number,
  ): Promise<UnifiedPullRequest> {
    return toUnifiedPullRequest(await fetchMergeRequestByIid(projectId, iid));
  }

  async searchPullRequests(
    query: string,
    projectIds: number[],
  ): Promise<UnifiedPullRequest[]> {
    return (await searchMergeRequests(query, projectIds)).map(
      toUnifiedPullRequest,
    );
  }

  async fetchOpenPullRequestsByBranch(
    projectId: number,
    branchName: string,
  ): Promise<UnifiedPullRequest[]> {
    return (await fetchMergeRequestsByBranchName(projectId, branchName))
      .filter(({ merge_status }) => merge_status !== 'merged')
      .map(toUnifiedPullRequest);
  }

  async fetchPullRequestCommitIds(
    projectId: number,
    iid: number,
  ): Promise<string[]> {
    return (await fetchMergeRequestCommits(projectId, iid)).map(({ id }) => id);
  }

  async fetchApprovalInfo(
    projectId: number,
    iid: number,
  ): Promise<UnifiedApprovalInfo> {
    const info = await fetchMergeRequestApprovers(projectId, iid);
    return {
      approvers: info.approvers.map(toUnifiedUser),
      approvalsRequired: info.approvals_required,
      approvalsLeft: info.approvals_left,
    };
  }

  async fetchReviewers(projectId: number, iid: number): Promise<UnifiedUser[]> {
    return (await fetchReviewers(projectId, iid)).map(toUnifiedUser);
  }

  async fetchPendingReviewerUsernames(
    projectId: number,
    iid: number,
  ): Promise<string[]> {
    return (await fetchMergeRequestReviewers(projectId, iid))
      .filter(({ state }) => state === 'unreviewed')
      .map(({ user }) => user.username);
  }

  async fetchUser(userId: number): Promise<UnifiedUser | undefined> {
    const user = await fetchUserById(userId);
    return user ? toUnifiedUser(user) : undefined;
  }

  async runPipeline(
    projectId: number,
    branchName: string,
    autoDeploy?: string,
  ): Promise<void> {
    const variables: GitlabCiVariable[] | undefined = autoDeploy
      ? [{ key: 'AUTO_DEPLOY', value: autoDeploy, variable_type: 'env_var' }]
      : undefined;
    await runPipeline(projectId, branchName, variables);
  }

  async rebasePullRequest(projectId: number, iid: number): Promise<void> {
    await rebaseMergeRequest(projectId, iid);
  }

  async findSlackUser(user: UnifiedUser): Promise<SlackUser | undefined> {
    return fetchSlackUserFromGitlabUsername(user.username);
  }

  async findGitUsername(slackUserId: string): Promise<string | undefined> {
    return fetchGitlabUsernameFromSlackUserId(slackUserId);
  }
}

export function toUnifiedUser(
  user: GitlabUser | GitlabUserDetails,
): UnifiedUser {
  return {
    id: user.id,
    username: user.username,
    name: user.name || user.username,
    webUrl: user.web_url,
    email: (user as GitlabUserDetails).public_email || undefined,
  };
}

function toUnifiedProject(project: GitlabProject): UnifiedProject {
  return {
    provider: 'gitlab',
    id: project.id,
    path: project.path_with_namespace,
    webUrl: project.web_url,
    defaultBranch: project.default_branch,
  };
}

const STATES: Record<GitlabMergeRequestState, UnifiedPullRequestState> = {
  closed: 'closed',
  locked: 'locked',
  merged: 'merged',
  opened: 'opened',
  reopened: 'opened',
};

function toUnifiedPullRequest(
  mergeRequest: GitlabMergeRequest | GitlabMergeRequestDetails,
): UnifiedPullRequest {
  const details = mergeRequest as Partial<GitlabMergeRequestDetails>;

  return {
    provider: 'gitlab',
    projectId: mergeRequest.project_id,
    iid: mergeRequest.iid,
    title: mergeRequest.title,
    webUrl: mergeRequest.web_url,
    state: STATES[mergeRequest.state] ?? 'opened',
    sourceBranch: mergeRequest.source_branch,
    targetBranch: mergeRequest.target_branch,
    author: toUnifiedUser(mergeRequest.author),
    assignees: (mergeRequest.assignees ?? []).map(toUnifiedUser),
    discussionsCount: mergeRequest.user_notes_count || 0,
    changesCount: details.changes_count ?? '',
    pipelineStatus: details.head_pipeline?.status,
    mergeable: mergeRequest.merge_status === 'can_be_merged',
  };
}
