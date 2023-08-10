import type { GitlabCommit } from '@/core/typings/GitlabCommit';
import type { GitlabProjectDetails } from '@/core/typings/GitlabProject';
import type { GitlabRunner } from '@/core/typings/GitlabRunner';
import type { GitlabUser } from '@/core/typings/GitlabUser';

export interface GitlabJobHook {
  before_sha: string;
  build_allow_failure: boolean;
  build_duration: number | null;
  build_failure_reason: string;
  build_finished_at: string | null;
  build_id: number;
  build_name: string;
  build_stage: string;
  build_started_at: string | null;
  build_status: 'created' | 'running' | 'success';
  commit: Pick<GitlabCommit, 'message' | 'author_name' | 'author_email'> & {
    id: number;
    sha: string;
  };
  object_kind: 'build';
  pipeline_id: number;
  project_id: number;
  project_name: string;
  ref: string;
  repository: Pick<GitlabProjectDetails, 'name' | 'description'> & {
    git_http_url: string;
    git_ssh_url: string;
    homepage: string;
    visibility_level: number;
  };
  runner: GitlabRunner | null;
  sha: string; // Not complete
  tag: boolean;
  user: Pick<GitlabUser, 'avatar_url' | 'id' | 'name'> & { email: string };
}
