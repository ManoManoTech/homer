import { githubSimplePullRequestFixture } from './githubPullRequestFixture';
import {
  githubRepositoryFixture,
  githubReviewerFixture,
} from './githubRepositoryFixture';

function buildReviewFixture({
  id,
  nodeId,
  body,
  state,
  submittedAt,
}: {
  id: number;
  nodeId: string;
  body: string | null;
  state: string;
  submittedAt: string;
}) {
  const htmlUrl = `${githubSimplePullRequestFixture.html_url}#pullrequestreview-${id}`;

  return {
    id,
    node_id: nodeId,
    user: githubReviewerFixture,
    body,
    commit_id: githubSimplePullRequestFixture.head.sha,
    submitted_at: submittedAt,
    state,
    html_url: htmlUrl,
    pull_request_url: githubSimplePullRequestFixture.url,
    author_association: 'MEMBER',
    _links: {
      html: { href: htmlUrl },
      pull_request: { href: githubSimplePullRequestFixture.url },
    },
  };
}

export const pullRequestReviewApprovedHookFixture = {
  action: 'submitted',
  review: buildReviewFixture({
    id: 220001,
    nodeId: 'PRR_kwDOAANh',
    body: null,
    state: 'approved',
    submittedAt: '2024-05-14T13:05:22Z',
  }),
  pull_request: githubSimplePullRequestFixture,
  repository: githubRepositoryFixture,
  sender: githubReviewerFixture,
};

/**
 * GitHub reports "changes requested", which GitLab has no equivalent for. A
 * reviewer cannot withdraw an approval: it is either superseded by a review
 * like this one, or dismissed (`action: 'dismissed'`).
 */
export const pullRequestReviewChangesRequestedHookFixture = {
  action: 'submitted',
  review: buildReviewFixture({
    id: 220002,
    nodeId: 'PRR_kwDOAANi',
    body: 'Please move the retry count behind a configuration value.',
    state: 'changes_requested',
    submittedAt: '2024-05-14T13:22:48Z',
  }),
  pull_request: githubSimplePullRequestFixture,
  repository: githubRepositoryFixture,
  sender: githubReviewerFixture,
};
