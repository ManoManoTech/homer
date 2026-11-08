/** Subset of the GitHub REST API models used by Homer. */

export interface GithubUser {
  id: number;
  login: string;
  html_url: string;
  /** Only returned by the users endpoints. */
  name?: string | null;
  /** Public email, only returned by the users endpoints. */
  email?: string | null;
}

export interface GithubRepository {
  id: number;
  full_name: string;
  html_url: string;
  default_branch: string;
}

export interface GithubBranchRef {
  ref: string;
  sha: string;
  repo: GithubRepository | null;
}

export interface GithubPullRequest {
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  draft?: boolean;
  locked: boolean;
  merged?: boolean;
  merged_at: string | null;
  user: GithubUser;
  assignees: GithubUser[];
  requested_reviewers: GithubUser[];
  head: GithubBranchRef;
  base: GithubBranchRef;
  labels: { name: string }[];
  /** Only returned when fetching a single pull request. */
  comments?: number;
  review_comments?: number;
  changed_files?: number;
  mergeable?: boolean | null;
  mergeable_state?: string;
}

export type GithubReviewState =
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'COMMENTED'
  | 'DISMISSED'
  | 'PENDING';

export interface GithubReview {
  id: number;
  user: GithubUser | null;
  state: GithubReviewState;
  body: string | null;
  html_url: string;
  submitted_at?: string;
}

export interface GithubCheckRun {
  id: number;
  name: string;
  status:
    | 'queued'
    | 'in_progress'
    | 'completed'
    | 'waiting'
    | 'requested'
    | 'pending';
  conclusion:
    | 'action_required'
    | 'cancelled'
    | 'failure'
    | 'neutral'
    | 'skipped'
    | 'stale'
    | 'startup_failure'
    | 'success'
    | 'timed_out'
    | null;
}

export interface GithubCombinedStatus {
  state: 'error' | 'failure' | 'pending' | 'success';
  total_count: number;
}

export interface GithubCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string } | null;
    committer: { name: string; email: string; date: string } | null;
  };
}

export interface GithubWorkflowRun {
  id: number;
  name: string;
  workflow_id: number;
  head_branch: string;
  head_sha: string;
  event: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
}
