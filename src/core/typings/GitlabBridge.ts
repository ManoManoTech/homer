import type { GitlabCommit } from '@/core/typings/GitlabCommit';
import type { GitlabPipeline } from '@/core/typings/GitlabPipeline';
import type { GitlabUser } from '@/core/typings/GitlabUser';

export type GitlabDownstreamPipeline = Pick<
  GitlabPipeline,
  'created_at' | 'id' | 'ref' | 'sha' | 'status' | 'updated_at' | 'web_url'
>;

export interface GitlabBridge {
  allow_failure: boolean;
  commit: Pick<
    GitlabCommit,
    | 'author_email'
    | 'author_name'
    | 'created_at'
    | 'id'
    | 'message'
    | 'short_id'
    | 'title'
  >;
  coverage: number | null;
  created_at: string;
  downstream_pipeline: GitlabDownstreamPipeline | null;
  finished_at: string;
  id: number;
  started_at: string;
  duration: number;
  name: string;
  pipeline: Pick<
    GitlabPipeline,
    | 'created_at'
    | 'id'
    | 'project_id'
    | 'ref'
    | 'sha'
    | 'status'
    | 'updated_at'
    | 'web_url'
  >;
  ref: string;
  queued_duration: number;
  stage: string;
  status:
    | 'canceled'
    | 'created'
    | 'failed'
    | 'manual'
    | 'pending'
    | 'running'
    | 'skipped'
    | 'success';
  tag: false;
  user: GitlabUser;
  web_url: string;
}
