import { CONFIG } from '@/config';
import type {
  GithubCheckRun,
  GithubCombinedStatus,
  GithubCommit,
  GithubPullRequest,
  GithubRepository,
  GithubReview,
  GithubUser,
  GithubWorkflowRun,
} from '@/core/typings/GithubModels';

const PER_PAGE = 100;

export class GithubApiError extends Error {
  constructor(
    readonly status: number,
    path: string,
    body: string,
  ) {
    super(`GitHub API error ${status} on ${path}: ${body}`);
  }
}

export function isGithubConfigured(): boolean {
  return CONFIG.github.token !== '';
}

// Repository ids are stable while names change on rename, so Homer stores ids
// and resolves names through this cache.
const repositoryNames = new Map<number, string>();

export async function fetchRepositoryById(
  id: number,
): Promise<GithubRepository> {
  const repository = await callAPI<GithubRepository>(`/repositories/${id}`);
  repositoryNames.set(repository.id, repository.full_name);
  return repository;
}

export async function fetchRepositoryByName(
  fullName: string,
): Promise<GithubRepository> {
  const repository = await callAPI<GithubRepository>(`/repos/${fullName}`);
  repositoryNames.set(repository.id, repository.full_name);
  return repository;
}

async function getRepositoryName(id: number): Promise<string> {
  return repositoryNames.get(id) ?? (await fetchRepositoryById(id)).full_name;
}

async function repoPath(id: number): Promise<string> {
  return `/repos/${await getRepositoryName(id)}`;
}

export async function searchRepositories(
  query: string,
): Promise<GithubRepository[]> {
  const { items } = await callAPI<{ items: GithubRepository[] }>(
    `/search/repositories?q=${encodeURIComponent(query)}&per_page=20`,
  );
  items.forEach(({ full_name, id }) => repositoryNames.set(id, full_name));
  return items;
}

export async function fetchPullRequest(
  repositoryId: number,
  number: number,
): Promise<GithubPullRequest> {
  return callAPI(`${await repoPath(repositoryId)}/pulls/${number}`);
}

export async function fetchPullRequestByName(
  fullName: string,
  number: number,
): Promise<GithubPullRequest> {
  return callAPI(`/repos/${fullName}/pulls/${number}`);
}

export async function fetchOpenPullRequestsByBranch(
  repositoryId: number,
  branchName: string,
): Promise<GithubPullRequest[]> {
  const name = await getRepositoryName(repositoryId);
  const owner = name.split('/')[0];
  return callAPI(
    `/repos/${name}/pulls?state=open&head=${encodeURIComponent(
      `${owner}:${branchName}`,
    )}`,
  );
}

/**
 * @returns pull request numbers matching the text, per repository full name.
 */
export async function searchOpenPullRequests(
  query: string,
  repositoryIds: number[],
): Promise<{ repositoryName: string; number: number }[]> {
  if (repositoryIds.length === 0) {
    return [];
  }

  const names = await Promise.all(repositoryIds.map(getRepositoryName));
  const q = [
    query,
    'is:pr',
    'is:open',
    ...names.map((name) => `repo:${name}`),
  ].join(' ');
  const { items } = await callAPI<{
    items: { number: number; repository_url: string }[];
  }>(`/search/issues?q=${encodeURIComponent(q)}&per_page=20`);

  return items.map(({ number, repository_url }) => ({
    number,
    repositoryName: repository_url.split('/').slice(-2).join('/'),
  }));
}

export async function fetchPullRequestCommits(
  repositoryId: number,
  number: number,
): Promise<GithubCommit[]> {
  return callAPI(
    `${await repoPath(repositoryId)}/pulls/${number}/commits?per_page=${PER_PAGE}`,
  );
}

export async function fetchPullRequestReviews(
  repositoryId: number,
  number: number,
): Promise<GithubReview[]> {
  return callAPI(
    `${await repoPath(repositoryId)}/pulls/${number}/reviews?per_page=${PER_PAGE}`,
  );
}

/**
 * Reads the required approvals from rulesets, then from classic branch
 * protection. Both need read access, so 0 is returned when nothing is found.
 */
export async function fetchRequiredApprovals(
  repositoryId: number,
  branchName: string,
): Promise<number> {
  const path = await repoPath(repositoryId);
  const branch = encodeURIComponent(branchName);

  try {
    const rules = await callAPI<
      {
        type: string;
        parameters?: { required_approving_review_count?: number };
      }[]
    >(`${path}/rules/branches/${branch}`);
    const counts = rules
      .filter(({ type }) => type === 'pull_request')
      .map(
        ({ parameters }) => parameters?.required_approving_review_count ?? 0,
      );

    if (counts.length > 0) {
      return Math.max(...counts);
    }
  } catch {
    // Rulesets may be unavailable on the plan or for the token.
  }

  try {
    const protection = await callAPI<{
      required_approving_review_count?: number;
    }>(`${path}/branches/${branch}/protection/required_pull_request_reviews`);
    return protection.required_approving_review_count ?? 0;
  } catch {
    return 0;
  }
}

export async function fetchCheckRuns(
  repositoryId: number,
  ref: string,
): Promise<GithubCheckRun[]> {
  const { check_runs } = await callAPI<{ check_runs: GithubCheckRun[] }>(
    `${await repoPath(repositoryId)}/commits/${ref}/check-runs?per_page=${PER_PAGE}`,
  );
  return check_runs;
}

export async function fetchCombinedStatus(
  repositoryId: number,
  ref: string,
): Promise<GithubCombinedStatus> {
  return callAPI(`${await repoPath(repositoryId)}/commits/${ref}/status`);
}

export async function fetchUserById(id: number): Promise<GithubUser> {
  return callAPI(`/user/${id}`);
}

export async function fetchUserByLogin(login: string): Promise<GithubUser> {
  return callAPI(`/users/${encodeURIComponent(login)}`);
}

export async function fetchWorkflowRuns(
  repositoryId: number,
  filters: { branch?: string; event?: string; headSha?: string },
): Promise<GithubWorkflowRun[]> {
  const params = new URLSearchParams({ per_page: `${PER_PAGE}` });
  if (filters.branch) params.set('branch', filters.branch);
  if (filters.event) params.set('event', filters.event);
  if (filters.headSha) params.set('head_sha', filters.headSha);

  const { workflow_runs } = await callAPI<{
    workflow_runs: GithubWorkflowRun[];
  }>(`${await repoPath(repositoryId)}/actions/runs?${params}`);
  return workflow_runs;
}

export async function rerunWorkflowRun(
  repositoryId: number,
  runId: number,
): Promise<void> {
  await callAPI(`${await repoPath(repositoryId)}/actions/runs/${runId}/rerun`, {
    method: 'POST',
  });
}

export async function cancelWorkflowRun(
  repositoryId: number,
  runId: number,
): Promise<void> {
  await callAPI(
    `${await repoPath(repositoryId)}/actions/runs/${runId}/cancel`,
    { method: 'POST' },
  );
}

export async function updatePullRequestBranch(
  repositoryId: number,
  number: number,
): Promise<void> {
  await callAPI(
    `${await repoPath(repositoryId)}/pulls/${number}/update-branch`,
    { method: 'PUT' },
  );
}

export async function callAPI<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${CONFIG.github.apiUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${CONFIG.github.token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new GithubApiError(response.status, path, await response.text());
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
