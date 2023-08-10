export type GitlabPipelineStatus =
  | 'canceled'
  | 'created'
  | 'failed'
  | 'manual'
  | 'pending'
  | 'preparing'
  | 'running'
  | 'scheduled'
  | 'skipped'
  | 'success'
  | 'waiting_for_resource';

export interface GitlabPipeline {
  /** @example 2016-08-11T11:28:34.085Z */
  created_at: string;
  id: number;
  iid: number;
  project_id: number;
  /** Branch name or tag */
  ref: string;
  sha: string;
  source:
    | 'api'
    | 'chat'
    | 'external'
    | 'external_pull_request_event'
    | 'merge_request_event'
    | 'ondemand_dast_scan'
    | 'ondemand_dast_validation'
    | 'parent_pipeline'
    | 'pipeline'
    | 'push'
    | 'schedule'
    | 'trigger'
    | 'web'
    | 'webide';
  status: GitlabPipelineStatus;
  /** @example 2016-08-11T11:28:34.085Z */
  updated_at: string;
  /** @example https://example.com/foo/bar/pipelines/47 */
  web_url: string;
}
