/**
 * GitHub API service
 * Provides functions to interact with GitHub REST API v3
 */

import { logger } from '@/core/services/logger';
import type { GitHubPullRequest } from '@/core/typings/GitHubPullRequest';
import type { GitHubRepository } from '@/core/typings/GitHubRepository';
import type { GitHubReview } from '@/core/typings/GitHubReview';
import type { GitHubUser } from '@/core/typings/GitHubUser';
import { getEnvVariable } from '@/core/utils/getEnvVariable';

const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_TOKEN = getEnvVariable('GITHUB_TOKEN');

// Log token status at startup (safely, without exposing the actual token)
logger.info({
  tokenConfigured: !!GITHUB_TOKEN,
  tokenLength: GITHUB_TOKEN?.length,
  tokenPrefix: GITHUB_TOKEN?.substring(0, 4),
}, 'GitHub API initialized');

/**
 * Make an API call to GitHub
 */
async function callAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${GITHUB_API_URL}${endpoint}`;
  const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    ...options.headers,
  };

  logger.debug({
    endpoint,
    method: options.method || 'GET',
    url,
  }, 'GitHub API request');

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error({
      endpoint,
      status: response.status,
      statusText: response.statusText,
      errorBody,
      rateLimitRemaining: response.headers.get('x-ratelimit-remaining'),
      rateLimitReset: response.headers.get('x-ratelimit-reset'),
    }, 'GitHub API error');

    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText} - ${errorBody}`
    );
  }

  logger.debug({
    endpoint,
    status: response.status,
    rateLimitRemaining: response.headers.get('x-ratelimit-remaining'),
  }, 'GitHub API response');

  return response.json() as Promise<T>;
}

/**
 * Fetch a single pull request
 */
export async function fetchPullRequest(
  repoFullName: string,
  pullNumber: number
): Promise<GitHubPullRequest> {
  logger.info({ repoFullName, pullNumber }, 'Fetching GitHub pull request');
  try {
    const pr = await callAPI<GitHubPullRequest>(
      `/repos/${repoFullName}/pulls/${pullNumber}`
    );
    logger.info({
      repoFullName,
      pullNumber,
      prId: pr.id,
      prTitle: pr.title,
      prState: pr.state,
    }, 'Successfully fetched GitHub pull request');
    return pr;
  } catch (error) {
    logger.error({
      repoFullName,
      pullNumber,
      error: error instanceof Error ? error.message : String(error),
    }, 'Failed to fetch GitHub pull request');
    throw error;
  }
}

/**
 * Fetch a repository
 */
export async function fetchRepository(
  repoFullName: string
): Promise<GitHubRepository> {
  logger.info({ repoFullName }, 'Fetching GitHub repository');
  try {
    const repo = await callAPI<GitHubRepository>(`/repos/${repoFullName}`);
    logger.info({
      repoFullName,
      id: repo.id,
      fullName: repo.full_name,
    }, 'Successfully fetched GitHub repository');
    return repo;
  } catch (error) {
    logger.error({
      repoFullName,
      error: error instanceof Error ? error.message : String(error),
    }, 'Failed to fetch GitHub repository');
    throw error;
  }
}

/**
 * Fetch a user by ID
 */
export async function fetchUser(_userId: number): Promise<GitHubUser> {
  // GitHub API doesn't support fetching user by ID directly
  // This would need to be implemented differently or through a different endpoint
  // For now, throwing not implemented
  throw new Error('Fetching user by ID not implemented for GitHub');
}

/**
 * Fetch a user by username
 */
export async function fetchUserByUsername(
  username: string
): Promise<GitHubUser> {
  return callAPI<GitHubUser>(`/users/${username}`);
}

/**
 * Fetch requested reviewers for a pull request
 */
export async function fetchRequestedReviewers(
  repoFullName: string,
  pullNumber: number
): Promise<GitHubUser[]> {
  const response = await callAPI<{ users: GitHubUser[] }>(
    `/repos/${repoFullName}/pulls/${pullNumber}/requested_reviewers`
  );
  return response.users || [];
}

/**
 * Fetch reviews for a pull request
 */
export async function fetchPullRequestReviews(
  repoFullName: string,
  pullNumber: number
): Promise<GitHubReview[]> {
  return callAPI<GitHubReview[]>(
    `/repos/${repoFullName}/pulls/${pullNumber}/reviews`
  );
}

/**
 * Fetch assignees for a pull request
 */
export async function fetchPullRequestAssignees(
  repoFullName: string,
  pullNumber: number
): Promise<GitHubUser[]> {
  const pr = await fetchPullRequest(repoFullName, pullNumber);
  // GitHub PRs have assignees array directly in the PR object
  return (pr as any).assignees || [];
}
