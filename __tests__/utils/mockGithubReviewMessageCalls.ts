import type { GithubPullRequest } from '@/core/typings/GithubModels';
import {
  githubPullRequestFixture,
  githubReviewsFixture,
} from '../__fixtures__/github/pullRequestFixture';
import { githubRepositoryFixture } from '../__fixtures__/github/repositoryFixture';
import { mockGithubCall } from './mockGithubCall';

export function mockGithubReviewMessageCalls(
  pullRequest: GithubPullRequest = githubPullRequestFixture,
) {
  const { full_name, id } = githubRepositoryFixture;
  const repo = `/repos/${full_name}`;

  mockGithubCall(`/repositories/${id}`, githubRepositoryFixture);
  mockGithubCall(`${repo}/pulls/${pullRequest.number}`, pullRequest);
  mockGithubCall(
    `${repo}/commits/${pullRequest.head.sha}/check-runs?per_page=100`,
    {
      check_runs: [
        { id: 1, name: 'build', status: 'completed', conclusion: 'success' },
        { id: 2, name: 'test', status: 'in_progress', conclusion: null },
      ],
    },
  );
  mockGithubCall(`${repo}/commits/${pullRequest.head.sha}/status`, {
    state: 'pending',
    total_count: 0,
  });
  mockGithubCall(
    `${repo}/pulls/${pullRequest.number}/reviews?per_page=100`,
    githubReviewsFixture,
  );
  mockGithubCall(`${repo}/rules/branches/${pullRequest.base.ref}`, [
    {
      type: 'pull_request',
      parameters: { required_approving_review_count: 2 },
    },
  ]);
}
