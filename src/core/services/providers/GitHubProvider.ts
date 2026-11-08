import { CONFIG } from "@/config";
import {
  fetchRepositoryById,
  fetchRepositoryByName,
  fetchUserByLogin,
  GithubApiError,
  searchRepositories,
} from "@/core/services/github";
import { fetchSlackUserFromEmails } from "@/core/services/slack";
import type { GithubRepository, GithubUser } from "@/core/typings/GithubModels";
import type { RepositoryProvider } from "@/core/typings/RepositoryProvider";
import type { SlackUser } from "@/core/typings/SlackUser";
import type {
  UnifiedApprovalInfo,
  UnifiedProject,
  UnifiedPullRequest,
  UnifiedUser,
} from "@/core/typings/UnifiedModels";

const REPOSITORY_NAME_REGEX = /^[\w.-]+\/[\w.-]+$/;

/** GitHub login to email, used when logins do not match emails. */
export type GithubUsersMapping = Record<string, string>;

export class GitHubProvider implements RepositoryProvider {
  readonly type = "github" as const;

  private readonly usersMapping: Map<string, string>;
  private readonly publicEmails = new Map<string, string | null>();

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

  getWebhookSettingsUrl(project: Pick<UnifiedProject, "path">): string {
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

  /**
   * Tries, in order: the configured mapping, the public email of the GitHub
   * profile (GitHub verifies it), then `<login>@<EMAIL_DOMAINS>` like GitLab
   * when `GITHUB_LOGIN_MATCHES_EMAIL` allows it.
   */
  async findSlackUser(user: UnifiedUser): Promise<SlackUser | undefined> {
    const login = user.username;
    const emails = [
      this.usersMapping.get(login.toLowerCase()),
      user.email ?? (await this.fetchPublicEmail(login)),
      ...(CONFIG.github.loginMatchesEmail
        ? CONFIG.slack.emailDomains
            .split(",")
            .map((emailDomain) => `${login}@${emailDomain}`)
        : []),
    ].filter((email): email is string => !!email);

    return fetchSlackUserFromEmails([...new Set(emails)]);
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

  async findGitUsername(): Promise<string | undefined> {
    throw notImplemented();
  }
}

function notImplemented(): Error {
  return new Error("Not supported on GitHub yet");
}

/**
 * Extracts `owner/repo` from a repository name or URL.
 */
function getRepositoryName(query: string): string | undefined {
  if (query.startsWith(CONFIG.github.url)) {
    const name = new URL(query).pathname.split("/").filter(Boolean).slice(0, 2);
    return name.length === 2 ? name.join("/") : undefined;
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
    provider: "github",
    id: repository.id,
    path: repository.full_name,
    webUrl: repository.html_url,
    defaultBranch: repository.default_branch,
  };
}
