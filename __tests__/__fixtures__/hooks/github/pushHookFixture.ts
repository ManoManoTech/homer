import {
  githubRepositoryFixture,
  githubUserFixture,
} from './githubRepositoryFixture';

const BEFORE_SHA = '4f5e6d7c8b9a0192837465564738291a0b1c2d3e';
const AFTER_SHA = '9c1f2a7b6d5e4c3b2a1908f7e6d5c4b3a2918007';

const commitAuthor = {
  name: 'Octo Dev',
  email: 'octo-dev@example.test',
  username: githubUserFixture.login,
};

/**
 * GitHub commits have no `title` field: the first line of `message` has to be
 * used instead.
 */
const commits = [
  {
    id: 'bb22cc33dd44ee55ff6677889900aabbccddeeff',
    tree_id: 'cc33dd44ee55ff6677889900aabbccddeeff0011',
    distinct: true,
    message:
      'Retry the Slack call once on a server error\n\nThe sender used to drop the notification on the first failure.',
    timestamp: '2024-05-14T09:58:12+02:00',
    url: `${githubRepositoryFixture.html_url}/commit/bb22cc33dd44ee55ff6677889900aabbccddeeff`,
    author: commitAuthor,
    committer: commitAuthor,
    added: ['src/review/services/retryNotification.ts'],
    modified: ['src/review/services/sendNotification.ts'],
    removed: [],
  },
  {
    id: AFTER_SHA,
    tree_id: 'dd44ee55ff6677889900aabbccddeeff00112233',
    distinct: true,
    message: 'Cover the retry with a test',
    timestamp: '2024-05-14T10:03:44+02:00',
    url: `${githubRepositoryFixture.html_url}/commit/${AFTER_SHA}`,
    author: commitAuthor,
    committer: commitAuthor,
    added: ['__tests__/review/retryNotification.test.ts'],
    modified: [],
    removed: [],
  },
];

export const pushHookFixtureFeatureBranch = {
  ref: 'refs/heads/feat/retry-notification-sender',
  before: BEFORE_SHA,
  after: AFTER_SHA,
  created: false,
  deleted: false,
  forced: false,
  base_ref: null,
  compare: `${githubRepositoryFixture.html_url}/compare/${BEFORE_SHA.slice(0, 12)}...${AFTER_SHA.slice(0, 12)}`,
  commits,
  head_commit: commits[commits.length - 1],
  repository: githubRepositoryFixture,
  pusher: {
    name: commitAuthor.name,
    email: commitAuthor.email,
  },
  sender: githubUserFixture,
};

export const pushHookFixture = {
  ...pushHookFixtureFeatureBranch,
  ref: `refs/heads/${githubRepositoryFixture.default_branch}`,
};
