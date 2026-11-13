import { githubPullRequestFixture } from './githubPullRequestFixture';
import {
  githubLabelFixture,
  githubRepositoryFixture,
  githubReviewerFixture,
  githubUserFixture,
} from './githubRepositoryFixture';

const ISSUE_API_URL = `https://api.example-github.test/repos/${githubRepositoryFixture.full_name}/issues/${githubPullRequestFixture.number}`;
const COMMENT_ID = 330001;

/**
 * A pull request is also an issue on GitHub, so a general comment on it
 * arrives as `issue_comment`. The only thing that tells a pull request apart
 * from a plain issue is the presence of `issue.pull_request`.
 */
export const issueCommentOnPullRequestHookFixture = {
  action: 'created',
  issue: {
    url: ISSUE_API_URL,
    repository_url: githubRepositoryFixture.url,
    comments_url: `${ISSUE_API_URL}/comments`,
    html_url: githubPullRequestFixture.html_url,
    id: 120001,
    node_id: 'I_kwDOAAHS',
    number: githubPullRequestFixture.number,
    title: githubPullRequestFixture.title,
    user: githubUserFixture,
    labels: [githubLabelFixture],
    state: 'open',
    locked: false,
    draft: false,
    active_lock_reason: null,
    assignee: null,
    assignees: [],
    milestone: null,
    comments: 3,
    created_at: githubPullRequestFixture.created_at,
    updated_at: '2024-05-14T14:09:31Z',
    closed_at: null,
    author_association: 'MEMBER',
    pull_request: {
      url: githubPullRequestFixture.url,
      html_url: githubPullRequestFixture.html_url,
      diff_url: githubPullRequestFixture.diff_url,
      patch_url: githubPullRequestFixture.patch_url,
      merged_at: null,
    },
    body: githubPullRequestFixture.body,
  },
  comment: {
    url: `https://api.example-github.test/repos/${githubRepositoryFixture.full_name}/issues/comments/${COMMENT_ID}`,
    html_url: `${githubPullRequestFixture.html_url}#issuecomment-${COMMENT_ID}`,
    issue_url: ISSUE_API_URL,
    id: COMMENT_ID,
    node_id: 'IC_kwDOAAUB',
    user: githubReviewerFixture,
    created_at: '2024-05-14T14:09:31Z',
    updated_at: '2024-05-14T14:09:31Z',
    author_association: 'MEMBER',
    body: 'Could you add a test for the second retry?',
  },
  repository: githubRepositoryFixture,
  sender: githubReviewerFixture,
};

/**
 * The same event on a plain issue, which Homer has to ignore. It is identical
 * apart from the missing `issue.pull_request`.
 */
export const issueCommentOnIssueHookFixture = {
  ...issueCommentOnPullRequestHookFixture,
  issue: (() => {
    const { pull_request, ...issue } =
      issueCommentOnPullRequestHookFixture.issue;

    return {
      ...issue,
      id: 120002,
      node_id: 'I_kwDOAAHT',
      number: 43,
      title: 'Notification sender fails on a Slack timeout',
    };
  })(),
};
