import type { GitlabDeploymentStatus } from './GitlabDeployment';

export interface GitlabDeploymentHook {
  commit_title: string;
  commit_url: string;
  deployable_id: number;
  deployable_url: string;
  deployment_id: number;
  environment: string;
  object_kind: 'deployment';
  project: {
    avatar_url: null;
    ci_config_path: string;
    default_branch: string;
    description: string;
    git_http_url: string;
    git_ssh_url: string;
    homepage: string;
    http_url: string;
    id: number;
    name: string;
    namespace: string;
    path_with_namespace: string;
    ssh_url: string;
    url: string;
    visibility_level: number;
    web_url: string;
  };
  short_sha: string;
  status: GitlabDeploymentStatus;
  status_changed_at: string; // ex: 2021-04-28 21:50:00 +0200
  user: {
    id: number;
    name: string;
    username: string;
    avatar_url: string;
    email: string;
  };
  user_url: string;
}
