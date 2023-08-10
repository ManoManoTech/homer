import type { GitlabPipeline } from './GitlabPipeline';
import type { GitlabUser } from './GitlabUser';

export type GitlabDeploymentStatus =
  | 'canceled'
  | 'failed'
  | 'running'
  | 'success';

export interface GitlabDeployment {
  /** @example 2016-08-11T11:28:34.085Z */
  created_at: string;
  deployable: {
    commit: {
      author_email: string;
      author_name: string;
      created_at: string;
      id: string;
      message: string;
      short_id: string;
      title: string;
    };
    coverage: null;
    created_at: string;
    finished_at: string;
    id: number;
    name: string;
    pipeline: Omit<GitlabPipeline, 'project_id'>;
    project: {
      ci_job_token_scope_enabled: false;
    };
    ref: string;
    runner: null;
    stage: string;
    started_at: null;
    status: string;
    tag: false;
    user: {
      avatar_url: string;
      bio: string | null;
      /** @example 2016-08-11T11:28:34.085Z */
      created_at: string;
      id: number;
      linkedin: string;
      location: null;
      name: string;
      organization: string;
      skype: string;
      state: string;
      twitter: string;
      username: string;
      web_url: string;
      website_url: string;
    };
  };
  environment: {
    id: number;
    name: string;
    external_url: string;
  };
  id: number;
  iid: number;
  ref: string;
  sha: string;
  status: GitlabDeploymentStatus;
  /** @example 2016-08-11T11:28:34.085Z */
  updated_at: string;
  user: GitlabUser;
}
