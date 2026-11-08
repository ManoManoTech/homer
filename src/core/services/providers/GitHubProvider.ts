import { CONFIG } from '@/config';
import {
  fetchRepositoryById,
  fetchRepositoryByName,
  GithubApiError,
  searchRepositories,
} from '@/core/services/github';
import type { GithubRepository } from '@/core/typings/GithubModels';
import type { RepositoryProvider } from '@/core/typings/RepositoryProvider';
import type { SlackUser } from '@/core/typings/SlackUser';
import type {
  UnifiedApprovalInfo,
  UnifiedProject,
  UnifiedPullRequest,
  UnifiedUser,
} from '@/core/typings/UnifiedModels';

const REPOSITORY_NAME_REGEX = /^[\w.-]+\/[\w.-]+$/;

export class GitHubProvider implements RepositoryProvider {
  readonly type = 'github' as const;

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

  async fetchPullRequest(): Promise<UnifiedPullRequest> {
    throw notImplemented();
  }

  async searchPullRequests(): Promise<UnifiedPullRequest[]> {
    throw notImplemented();
  }

  async fetchOpenPullRequestsByBranch(): Promise<UnifiedPullRequest[]> {
    throw notImplemented();
  }

  async fetchPullRequestCommitIds(): Promise<string[]> {
    throw notImplemented();
  }

  async fetchApprovalInfo(): Promise<UnifiedApprovalInfo> {
    throw notImplemented();
  }

  async fetchReviewers(): Promise<UnifiedUser[]> {
    throw notImplemented();
  }

  async fetchPendingReviewerUsernames(): Promise<string[]> {
    throw notImplemented();
  }

  async fetchUser(): Promise<UnifiedUser | undefined> {
    throw notImplemented();
  }

  async runPipeline(): Promise<void> {
    throw notImplemented();
  }

  async rebasePullRequest(): Promise<void> {
    throw notImplemented();
  }

  async findSlackUser(): Promise<SlackUser | undefined> {
    throw notImplemented();
  }

  async findGitUsername(): Promise<string | undefined> {
    throw notImplemented();
  }
}

function notImplemented(): Error {
  return new Error('Not supported on GitHub yet');
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

function toUnifiedProject(repository: GithubRepository): UnifiedProject {
  return {
    provider: 'github',
    id: repository.id,
    path: repository.full_name,
    webUrl: repository.html_url,
    defaultBranch: repository.default_branch,
  };
}
