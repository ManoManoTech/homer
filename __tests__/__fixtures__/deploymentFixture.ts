import type { GitlabDeployment } from '@/core/typings/GitlabDeployment';
import { pipelineFixture } from './pipelineFixture';
import { tagFixture } from './tagFixture';

export const deploymentFixture: GitlabDeployment = {
  id: 42,
  iid: 2,
  ref: tagFixture.name,
  sha: tagFixture.commit.id,
  created_at: '2016-08-11T11:32:35.444Z',
  updated_at: '2016-08-11T11:34:01.123Z',
  status: 'success',
  user: {
    name: 'Administrator',
    username: 'root',
    id: 1,
    state: 'active',
    avatar_url:
      'http://www.gravatar.com/avatar/e64c7d89f26bd1972efa854d13d7dd61?s=80&d=identicon',
    web_url: 'http://localhost:3000/root',
  },
  environment: {
    id: 9,
    name: 'production',
    external_url: 'https://about.gitlab.com',
  },
  deployable: {
    id: 664,
    status: 'success',
    stage: 'deploy',
    name: 'deploy',
    ref: 'main',
    tag: false,
    coverage: null,
    created_at: '2016-08-11T11:32:24.456Z',
    started_at: null,
    finished_at: '2016-08-11T11:32:35.145Z',
    project: {
      ci_job_token_scope_enabled: false,
    },
    user: {
      id: 1,
      name: 'Administrator',
      username: 'root',
      state: 'active',
      avatar_url:
        'http://www.gravatar.com/avatar/e64c7d89f26bd1972efa854d13d7dd61?s=80&d=identicon',
      web_url: 'http://gitlab.dev/root',
      created_at: '2015-12-21T13:14:24.077Z',
      bio: null,
      location: null,
      skype: '',
      linkedin: '',
      twitter: '',
      website_url: '',
      organization: '',
    },
    commit: {
      id: 'a91957a858320c0e17f3a0eca7cfacbff50ea29a',
      short_id: 'a91957a8',
      title: "Merge branch 'rename-readme' into 'main'\r",
      author_name: 'Administrator',
      author_email: 'admin@example.com',
      created_at: '2016-08-11T13:28:26.000+02:00',
      message:
        "Merge branch 'rename-readme' into 'main'\r\n\r\nRename README\r\n\r\n\r\n\r\nSee merge request !2",
    },
    pipeline: {
      ...pipelineFixture,
      created_at: '2016-08-11T07:43:52.143Z',
      ref: tagFixture.name,
      sha: tagFixture.commit.id,
      status: 'success',
      updated_at: '2016-08-11T07:43:52.143Z',
      web_url: 'https://example.com/foo/bar/pipelines/61',
    },
    runner: null,
  },
};
