export const githubUserFixture = {
  login: 'octo-dev',
  id: 4001,
  node_id: 'U_kgDOAAA0',
  avatar_url: 'https://avatars.example-github.test/u/4001?v=4',
  gravatar_id: '',
  url: 'https://api.example-github.test/users/octo-dev',
  html_url: 'https://example-github.test/octo-dev',
  type: 'User',
  site_admin: false,
};

export const githubReviewerFixture = {
  login: 'octo-reviewer',
  id: 4002,
  node_id: 'U_kgDOAAA1',
  avatar_url: 'https://avatars.example-github.test/u/4002?v=4',
  gravatar_id: '',
  url: 'https://api.example-github.test/users/octo-reviewer',
  html_url: 'https://example-github.test/octo-reviewer',
  type: 'User',
  site_admin: false,
};

export const githubRepositoryFixture = {
  id: 7001,
  node_id: 'R_kgDOAAA7',
  name: 'sample-service',
  full_name: 'sample-org/sample-service',
  private: true,
  owner: {
    login: 'sample-org',
    id: 9001,
    node_id: 'O_kgDOAAA9',
    avatar_url: 'https://avatars.example-github.test/u/9001?v=4',
    gravatar_id: '',
    url: 'https://api.example-github.test/users/sample-org',
    html_url: 'https://example-github.test/sample-org',
    type: 'Organization',
    site_admin: false,
  },
  html_url: 'https://example-github.test/sample-org/sample-service',
  description: 'A sample repository used by the test fixtures.',
  fork: false,
  url: 'https://api.example-github.test/repos/sample-org/sample-service',
  clone_url: 'https://example-github.test/sample-org/sample-service.git',
  git_url: 'git://example-github.test/sample-org/sample-service.git',
  ssh_url: 'git@example-github.test:sample-org/sample-service.git',
  homepage: null,
  language: 'TypeScript',
  archived: false,
  disabled: false,
  default_branch: 'main',
  visibility: 'private',
};

/**
 * `head.repo` / `base.repo` carry the same repository object as the top-level
 * `repository`; GitHub only omits it when the head repository was deleted.
 */
export const githubBranchRepositoryFixture = githubRepositoryFixture;

export const githubLabelFixture = {
  id: 5001,
  node_id: 'LA_kgDOAABN',
  url: 'https://api.example-github.test/repos/sample-org/sample-service/labels/homer-review',
  name: 'homer-review',
  color: 'd4c5f9',
  default: false,
  description: 'Share this pull request in Slack.',
};

export const githubMergeableLabelFixture = {
  id: 5002,
  node_id: 'LA_kgDOAABO',
  url: 'https://api.example-github.test/repos/sample-org/sample-service/labels/homer-mergeable',
  name: 'homer-mergeable',
  color: 'c2e0c6',
  default: false,
  description: 'Share this pull request once it only waits for approvals.',
};
