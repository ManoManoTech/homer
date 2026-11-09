import {
  githubBranchRepositoryFixture,
  githubLabelFixture,
  githubRepositoryFixture,
  githubReviewerFixture,
  githubUserFixture,
} from './githubRepositoryFixture';

const PULL_REQUEST_NUMBER = 42;
const PULL_REQUEST_API_URL = `https://api.example-github.test/repos/${githubRepositoryFixture.full_name}/pulls/${PULL_REQUEST_NUMBER}`;
const PULL_REQUEST_HTML_URL = `${githubRepositoryFixture.html_url}/pull/${PULL_REQUEST_NUMBER}`;

export const githubPullRequestFixture = {
  url: PULL_REQUEST_API_URL,
  id: 110001,
  node_id: 'PR_kwDOAAGw',
  html_url: PULL_REQUEST_HTML_URL,
  diff_url: `${PULL_REQUEST_HTML_URL}.diff`,
  patch_url: `${PULL_REQUEST_HTML_URL}.patch`,
  issue_url: `https://api.example-github.test/repos/${githubRepositoryFixture.full_name}/issues/${PULL_REQUEST_NUMBER}`,
  number: PULL_REQUEST_NUMBER,
  state: 'open',
  locked: false,
  title: 'Add a retry to the notification sender',
  user: githubUserFixture,
  body: 'Retries the Slack call once when it fails with a server error.',
  created_at: '2024-05-14T09:12:04Z',
  updated_at: '2024-05-14T09:12:04Z',
  closed_at: null,
  merged_at: null,
  merge_commit_sha: null,
  assignee: null,
  assignees: [],
  requested_reviewers: [githubReviewerFixture],
  requested_teams: [],
  labels: [githubLabelFixture],
  milestone: null,
  draft: false,
  comments_url: `https://api.example-github.test/repos/${githubRepositoryFixture.full_name}/issues/${PULL_REQUEST_NUMBER}/comments`,
  review_comments_url: `${PULL_REQUEST_API_URL}/comments`,
  commits_url: `${PULL_REQUEST_API_URL}/commits`,
  statuses_url: `https://api.example-github.test/repos/${githubRepositoryFixture.full_name}/statuses/9c1f2a7b6d5e4c3b2a1908f7e6d5c4b3a2918007`,
  head: {
    label: 'sample-org:feat/retry-notification-sender',
    ref: 'feat/retry-notification-sender',
    sha: '9c1f2a7b6d5e4c3b2a1908f7e6d5c4b3a2918007',
    user: githubUserFixture,
    repo: githubBranchRepositoryFixture,
  },
  base: {
    label: 'sample-org:main',
    ref: 'main',
    sha: '1a2b3c4d5e6f708192a3b4c5d6e7f80910111213',
    user: githubUserFixture,
    repo: githubBranchRepositoryFixture,
  },
  author_association: 'MEMBER',
  auto_merge: null,
  active_lock_reason: null,
  merged: false,
  // Often null in a webhook delivery: GitHub computes mergeability in the
  // background and the event can be sent before the job has finished.
  mergeable: true,
  rebaseable: true,
  // Only `mergeable_state` is in the payload. The richer GraphQL
  // `mergeStateStatus` / `reviewDecision` pair the design relies on is not.
  mergeable_state: 'blocked',
  merged_by: null,
  comments: 2,
  review_comments: 3,
  maintainer_can_modify: false,
  commits: 2,
  additions: 48,
  deletions: 7,
  changed_files: 4,
};

/**
 * `pull_request_review` and `issue_comment` carry a reduced pull request
 * object: no `merged`, `mergeable`, `mergeable_state`, `comments`,
 * `review_comments` or `changed_files`.
 */
export const githubSimplePullRequestFixture = (() => {
  const {
    merged,
    mergeable,
    rebaseable,
    mergeable_state,
    merged_by,
    comments,
    review_comments,
    maintainer_can_modify,
    commits,
    additions,
    deletions,
    changed_files,
    ...simplePullRequest
  } = githubPullRequestFixture;

  return simplePullRequest;
})();
