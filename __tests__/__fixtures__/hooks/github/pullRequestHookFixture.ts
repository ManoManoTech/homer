import { githubPullRequestFixture } from './githubPullRequestFixture';
import {
  githubMergeableLabelFixture,
  githubRepositoryFixture,
  githubUserFixture,
} from './githubRepositoryFixture';

export const pullRequestOpenedHookFixture = {
  action: 'opened',
  number: githubPullRequestFixture.number,
  pull_request: githubPullRequestFixture,
  repository: githubRepositoryFixture,
  sender: githubUserFixture,
};

/**
 * New commits were pushed to the pull request branch. `before` and `after` are
 * specific to this action.
 */
export const pullRequestSynchronizeHookFixture = {
  action: 'synchronize',
  number: githubPullRequestFixture.number,
  before: '4f5e6d7c8b9a0192837465564738291a0b1c2d3e',
  after: '9c1f2a7b6d5e4c3b2a1908f7e6d5c4b3a2918007',
  pull_request: {
    ...githubPullRequestFixture,
    updated_at: '2024-05-14T10:03:51Z',
    // GitHub restarts the mergeability job after a push, so the webhook sent
    // straight afterwards usually reports an unknown state.
    mergeable: null,
    mergeable_state: 'unknown',
  },
  repository: githubRepositoryFixture,
  sender: githubUserFixture,
};

/**
 * GitHub has no `merge` action: a merged pull request is `closed` with
 * `pull_request.merged` set to true.
 */
export const pullRequestClosedHookFixture = {
  action: 'closed',
  number: githubPullRequestFixture.number,
  pull_request: {
    ...githubPullRequestFixture,
    state: 'closed',
    closed_at: '2024-05-14T16:41:09Z',
    updated_at: '2024-05-14T16:41:09Z',
    merged: false,
    merged_at: null,
    merge_commit_sha: null,
    merged_by: null,
    mergeable: null,
    mergeable_state: 'unknown',
  },
  repository: githubRepositoryFixture,
  sender: githubUserFixture,
};

export const pullRequestMergedHookFixture = {
  action: 'closed',
  number: githubPullRequestFixture.number,
  pull_request: {
    ...githubPullRequestFixture,
    state: 'closed',
    closed_at: '2024-05-14T16:41:09Z',
    updated_at: '2024-05-14T16:41:09Z',
    merged: true,
    merged_at: '2024-05-14T16:41:09Z',
    merge_commit_sha: 'aa11bb22cc33dd44ee55ff6677889900aabbccdd',
    merged_by: githubUserFixture,
    mergeable: null,
    mergeable_state: 'unknown',
  },
  repository: githubRepositoryFixture,
  sender: githubUserFixture,
};

/**
 * A `labeled` delivery carries the label that was just added in `label`, and
 * the full list after the change in `pull_request.labels`.
 */
export const pullRequestLabeledHookFixture = {
  action: 'labeled',
  number: githubPullRequestFixture.number,
  label: githubMergeableLabelFixture,
  pull_request: {
    ...githubPullRequestFixture,
    updated_at: '2024-05-14T11:28:17Z',
    labels: [...githubPullRequestFixture.labels, githubMergeableLabelFixture],
  },
  repository: githubRepositoryFixture,
  sender: githubUserFixture,
};

export const pullRequestUnlabeledHookFixture = {
  action: 'unlabeled',
  number: githubPullRequestFixture.number,
  label: githubMergeableLabelFixture,
  pull_request: {
    ...githubPullRequestFixture,
    updated_at: '2024-05-14T11:33:02Z',
  },
  repository: githubRepositoryFixture,
  sender: githubUserFixture,
};

/**
 * Sent when a draft becomes reviewable. It is the second entry point to the
 * "share a pull request" decision, next to `opened`.
 */
export const pullRequestReadyForReviewHookFixture = {
  action: 'ready_for_review',
  number: githubPullRequestFixture.number,
  pull_request: {
    ...githubPullRequestFixture,
    draft: false,
    updated_at: '2024-05-14T09:47:35Z',
  },
  repository: githubRepositoryFixture,
  sender: githubUserFixture,
};

export const pullRequestConvertedToDraftHookFixture = {
  action: 'converted_to_draft',
  number: githubPullRequestFixture.number,
  pull_request: {
    ...githubPullRequestFixture,
    draft: true,
    updated_at: '2024-05-14T09:45:12Z',
    mergeable_state: 'draft',
  },
  repository: githubRepositoryFixture,
  sender: githubUserFixture,
};
