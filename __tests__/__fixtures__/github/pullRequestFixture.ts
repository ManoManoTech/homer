import type {
  GithubPullRequest,
  GithubReview,
  GithubUser,
} from '@/core/typings/GithubModels';
import { githubRepositoryFixture } from './repositoryFixture';

function user(id: number, login: string): GithubUser {
  return { id, login, html_url: `https://github.com/${login}` };
}

export const githubAuthorFixture = user(1, 'author');
export const githubAssigneeFixture = user(2, 'assignee');
export const githubReviewerFixture = user(3, 'reviewer');
export const githubApproverFixture = user(4, 'approver');

export const githubPullRequestFixture: GithubPullRequest = {
  number: 12,
  title: 'feat: add GitHub support',
  html_url: `${githubRepositoryFixture.html_url}/pull/12`,
  state: 'open',
  draft: false,
  locked: false,
  merged: false,
  merged_at: null,
  user: githubAuthorFixture,
  assignees: [githubAssigneeFixture],
  requested_reviewers: [githubReviewerFixture],
  head: {
    ref: 'feat/github',
    sha: 'headsha',
    repo: githubRepositoryFixture,
  },
  base: { ref: 'main', sha: 'basesha', repo: githubRepositoryFixture },
  labels: [],
  comments: 2,
  review_comments: 3,
  changed_files: 7,
  mergeable: true,
  mergeable_state: 'clean',
};

export const githubReviewsFixture: GithubReview[] = [
  {
    id: 1,
    user: githubApproverFixture,
    state: 'CHANGES_REQUESTED',
    body: '',
    html_url: `${githubPullRequestFixture.html_url}#review-1`,
  },
  {
    id: 2,
    user: githubApproverFixture,
    state: 'APPROVED',
    body: '',
    html_url: `${githubPullRequestFixture.html_url}#review-2`,
  },
];
