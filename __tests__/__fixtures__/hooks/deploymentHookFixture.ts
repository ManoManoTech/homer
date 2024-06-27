import type { GitlabDeploymentHook } from '@/core/typings/GitlabDeploymentHook';
import { deploymentFixture } from '../deploymentFixture';
import { projectFixture } from '../projectFixture';

export const deploymentHookFixture: GitlabDeploymentHook = {
  object_kind: 'deployment',
  status: 'success',
  status_changed_at: '2021-04-28 21:50:00 +0200',
  deployment_id: deploymentFixture.id,
  deployable_id: 796,
  deployable_url:
    'http://10.126.0.2:3000/root/diaspora-project-site/-/jobs/796',
  environment: 'staging',
  project: {
    id: projectFixture.id,
    name: 'diaspora-project-site',
    description: '',
    web_url: 'http://example.com/diaspora/diaspora-project-site',
    avatar_url: null,
    git_ssh_url: 'ssh://vlad@10.126.0.2:2222/root/diaspora-project-site.git',
    git_http_url: 'http://example.com/diaspora/diaspora-project-site.git',
    namespace: 'Administrator',
    visibility_level: 0,
    path_with_namespace: 'root/diaspora-project-site',
    default_branch: 'master',
    ci_config_path: '',
    homepage: 'http://example.com/diaspora/diaspora-project-site',
    url: 'ssh://vlad@example.com/diaspora/diaspora-project-site.git',
    ssh_url: 'ssh://vlad@example.com/diaspora/diaspora-project-site.git',
    http_url: 'http://example.com/diaspora/diaspora-project-site.git',
  },
  short_sha: '279484c0',
  user: {
    id: 1,
    name: 'Administrator',
    username: 'root',
    avatar_url:
      'https://www.gravatar.com/avatar/e64c7d89f26bd1972efa854d13d7dd61?s=80&d=identicon',
    email: 'admin@example.com',
  },
  user_url: 'http://10.126.0.2:3000/root',
  commit_url:
    'http://example.com/diaspora/diaspora-project-site/-/commit/279484c09fbe69ededfced8c1bb6e6d24616b468',
  commit_title: 'Add new file',
};
