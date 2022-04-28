export interface GitlabPipeline {
  /** @example 2016-08-11T11:28:34.085Z */
  created_at: string;
  id: number;
  project_id: number;
  /** Branch name */
  ref: string;
  sha: string;
  status:
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
  /** @example 2016-08-11T11:28:34.085Z */
  updated_at: string;
  /** @example https://example.com/foo/bar/pipelines/47 */
  web_url: string;
}
