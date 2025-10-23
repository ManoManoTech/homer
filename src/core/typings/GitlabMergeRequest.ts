import type { GitlabPipelineStatus } from './GitlabPipeline';
import type { GitlabUser } from './GitlabUser';

export type GitlabMergeRequestState =
  | 'locked'
  | 'merged'
  | 'opened'
  | 'reopened'
  | 'closed';

export type GitlabMergeRequestMergeStatus =
  | 'can_be_merged'
  | 'cannot_be_merged'
  | 'merged';

export interface GitlabMergeRequest {
  allow_collaboration: boolean;
  allow_maintainer_to_push: boolean;
  assignee: GitlabUser;
  assignees: GitlabUser[];
  author: GitlabUser;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
  description: string;
  discussion_locked: boolean | null;
  downvotes: number;
  force_remove_source_branch: boolean;
  id: number;
  iid: number;
  labels: string[];
  project_id: number;
  merge_commit_sha: string | null;
  merge_status: GitlabMergeRequestMergeStatus;
  merge_when_pipeline_succeeds: boolean;
  merged_by?: GitlabUser;
  merged_at?: string;
  milestone: {
    created_at: string;
    description: string;
    due_date: string;
    id: number;
    iid: number;
    project_id: number;
    start_date: string;
    state: string;
    title: string;
    updated_at: string;
    web_url: string;
  };
  references: {
    full: string;
    relative: string;
    short: string;
  };
  sha: string;
  should_remove_source_branch: boolean;
  source_branch: string;
  source_project_id: number;
  squash: boolean;
  squash_commit_sha: string | null;
  state: GitlabMergeRequestState;
  target_branch: string;
  target_project_id: number;
  task_completion_status: {
    count: number;
    completed_count: number;
  };
  time_stats: {
    human_time_estimate: number | null;
    human_total_time_spent: number | null;
    time_estimate: number;
    total_time_spent: number;
  };
  title: string;
  updated_at: string;
  upvotes: number;
  user_notes_count: number;
  web_url: string;
  work_in_progress: boolean;
}

export interface GitlabMergeRequestDetails extends GitlabMergeRequest {
  blocking_discussions_resolved: boolean;
  changes_count: string;
  diff_refs: {
    base_sha: string;
    head_sha: string;
    start_sha: string;
  };
  diverged_commits_count: number;
  first_contribution: boolean;
  first_deployed_to_production_at: string | null;
  has_conflicts: boolean;
  head_pipeline: {
    id: number;
    status: GitlabPipelineStatus;
    web_url: string;
  } | null;
  latest_build_finished_at: string;
  latest_build_started_at: string;
  merge_error: string | null;
  rebase_in_progress: boolean;
  subscribed: boolean;
}
