/**
 * Build status of the merge request's head commit, provider-neutral. GitLab
 * reports one pipeline; GitHub combines check runs and commit statuses, and the
 * provider adapter reduces either to one of these. `none` means the provider
 * reported no build at all.
 */
export type PipelineStatus =
  | 'success'
  | 'failed'
  | 'running'
  | 'pending'
  | 'canceled'
  | 'skipped'
  | 'manual'
  | 'none';
