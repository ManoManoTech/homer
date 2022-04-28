import { GitlabPipeline } from '@/core/typings/GitlabPipeline';
import { GitlabCommit } from '@/core/typings/GitlabCommit';
import { GitlabUser } from '@/core/typings/GitlabUser';

export interface GitlabJob {
  allow_failure: boolean;
  artifacts: [];
  artifacts_expire_at: string;
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
  duration: number;
  finished_at: string | null;
  id: number;
  name: string;
  pipeline: Pick<
    GitlabPipeline,
    'id' | 'project_id' | 'ref' | 'sha' | 'status'
  >;
  queued_duration: number;
  ref: string;
  runner: {
    active: boolean;
    description: string;
    id: number;
    is_shared: boolean;
    runner_type: string;
    tags: string[];
  } | null;
  stage: string;
  started_at: string | null;
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
  tag_list: string[];
  user: GitlabUser;
  web_url: string;
}
