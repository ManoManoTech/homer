import { CONFIG } from '@/config';
import type {
  GithubCheckRun,
  GithubCombinedStatus,
  GithubCommit,
  GithubPullRequest,
  GithubRepository,
  GithubReview,
  GithubUser,
  GithubRelease,
  GithubWorkflowJob,
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

export function clearRepositoryNames(): void {
  repositoryNames.clear();
}

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

/** GitHub lists at most 250 commits of a pull request. */
const MAX_PULL_REQUEST_COMMIT_PAGES = 3;

export async function fetchPullRequestCommits(
  repositoryId: number,
  number: number,
): Promise<GithubCommit[]> {
  const path = `${await repoPath(repositoryId)}/pulls/${number}/commits?per_page=${PER_PAGE}`;
  const commits: GithubCommit[] = [];

  for (let page = 1; page <= MAX_PULL_REQUEST_COMMIT_PAGES; page += 1) {
    const pageCommits = await callAPI<GithubCommit[]>(
      page === 1 ? path : `${path}&page=${page}`,
    );
    commits.push(...pageCommits);

    if (pageCommits.length < PER_PAGE) {
      break;
    }
  }
  return commits;
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
 * protection. Classic protection needs the Administration permission, so the
 * count is `undefined` when it cannot be read, rather than a wrong 0.
 */
export async function fetchRequiredApprovals(
  repositoryId: number,
  branchName: string,
): Promise<number | undefined> {
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
    // Also reached for unprotected branches: GitHub answers 404 for both.
    return undefined;
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

export async function fetchWorkflowRun(
  repositoryId: number,
  runId: number,
): Promise<GithubWorkflowRun> {
  return callAPI(`${await repoPath(repositoryId)}/actions/runs/${runId}`);
}

export async function fetchWorkflowRunJobs(
  repositoryId: number,
  runId: number,
): Promise<GithubWorkflowJob[]> {
  const { jobs } = await callAPI<{ jobs: GithubWorkflowJob[] }>(
    `${await repoPath(repositoryId)}/actions/runs/${runId}/jobs?per_page=${PER_PAGE}`,
  );
  return jobs;
}

export async function createRelease(
  repositoryId: number,
  commitId: string,
  tagName: string,
  description: string,
): Promise<void> {
  await callAPI(`${await repoPath(repositoryId)}/releases`, {
    method: 'POST',
    body: JSON.stringify({
      tag_name: tagName,
      target_commitish: commitId,
      name: tagName,
      body: description,
    }),
  });
}

export async function fetchReleaseByTagName(
  repositoryId: number,
  tagName: string,
): Promise<GithubRelease> {
  return callAPI(
    `${await repoPath(repositoryId)}/releases/tags/${encodeURIComponent(tagName)}`,
  );
}

export async function fetchReleases(
  repositoryId: number,
): Promise<GithubRelease[]> {
  return callAPI(
    `${await repoPath(repositoryId)}/releases?per_page=${PER_PAGE}`,
  );
}

export async function hasTag(
  repositoryId: number,
  tagName: string,
): Promise<boolean> {
  try {
    await callAPI(
      `${await repoPath(repositoryId)}/git/ref/tags/${encodeURIComponent(tagName)}`,
    );
    return true;
  } catch (error) {
    if (error instanceof GithubApiError && error.status === 404) {
      return false;
    }
    throw error;
  }
}

export async function updateRelease(
  repositoryId: number,
  releaseId: number,
  update: { name?: string; body?: string },
): Promise<void> {
  await callAPI(`${await repoPath(repositoryId)}/releases/${releaseId}`, {
    method: 'PATCH',
    body: JSON.stringify(update),
  });
}

interface GraphQLCommitTarget {
  committedDate?: string;
  /** Set on annotated tags, which point at a tag object. */
  target?: { committedDate?: string };
}

/** Newest first, ordered by the date of the tagged commit. */
export async function fetchTags(
  repositoryId: number,
): Promise<{ name: string; commitDate: string }[]> {
  const [owner, name] = (await getRepositoryName(repositoryId)).split('/');
  const data = await callGraphQL<{
    repository: {
      refs: { nodes: { name: string; target: GraphQLCommitTarget }[] };
    };
  }>(
    `query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        refs(refPrefix: "refs/tags/", first: 100, orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) {
          nodes {
            name
            target {
              ... on Commit { committedDate }
              ... on Tag { target { ... on Commit { committedDate } } }
            }
          }
        }
      }
    }`,
    { owner, name },
  );
  return data.repository.refs.nodes.map((node) => ({
    name: node.name,
    commitDate:
      node.target?.committedDate ?? node.target?.target?.committedDate ?? '',
  }));
}

const MAX_COMMIT_PAGES = 10;

/** Commits of `head` that are not in `base`, oldest first. */
export async function fetchComparedCommits(
  repositoryId: number,
  base: string,
  head: string,
): Promise<GithubCommit[]> {
  const path = `${await repoPath(repositoryId)}/compare/${encodeURIComponent(
    base,
  )}...${encodeURIComponent(head)}`;
  const commits: GithubCommit[] = [];

  for (let page = 1; page <= MAX_COMMIT_PAGES; page += 1) {
    const response = await callAPI<{ commits: GithubCommit[] }>(
      `${path}?per_page=${PER_PAGE}&page=${page}`,
    );
    commits.push(...response.commits);

    if (response.commits.length < PER_PAGE) {
      break;
    }
  }
  return commits;
}

/** Last commits of a branch, newest first. */
export async function fetchBranchCommits(
  repositoryId: number,
  branchName: string,
): Promise<GithubCommit[]> {
  return callAPI(
    `${await repoPath(repositoryId)}/commits?sha=${encodeURIComponent(
      branchName,
    )}&per_page=${PER_PAGE}`,
  );
}

/**
 * What a pull request still needs, as GitHub computes it: `reviewDecision`
 * applies CODEOWNERS and branch rules, and the rollup combines every check run
 * and commit status of the head commit.
 */
export async function fetchPullRequestMergeRequirements(
  repositoryId: number,
  number: number,
): Promise<{ reviewDecision: string | null; checksState: string | null }> {
  const [owner, name] = (await getRepositoryName(repositoryId)).split('/');
  const data = await callGraphQL<{
    repository: {
      pullRequest: {
        reviewDecision: string | null;
        commits: {
          nodes: { commit: { statusCheckRollup: { state: string } | null } }[];
        };
      };
    };
  }>(
    `query($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          reviewDecision
          commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
        }
      }
    }`,
    { owner, name, number },
  );
  const { commits, reviewDecision } = data.repository.pullRequest;

  return {
    reviewDecision,
    checksState: commits.nodes[0]?.commit.statusCheckRollup?.state ?? null,
  };
}

async function callGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  // GitHub Enterprise serves GraphQL on /api/graphql, next to /api/v3.
  const graphQLUrl = `${CONFIG.github.apiUrl.replace(/\/v3\/?$/, '')}/graphql`;
  const response = await fetch(graphQLUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CONFIG.github.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await response.json()) as {
    data?: T;
    errors?: { message: string }[];
  };

  if (!response.ok || body.errors?.length || body.data === undefined) {
    throw new GithubApiError(
      response.status,
      '/graphql',
      JSON.stringify(body.errors ?? body),
    );
  }
  return body.data;
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
