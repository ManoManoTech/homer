import type { GitlabJob } from '@/core/typings/GitlabJob';
import type { GitlabPipeline } from '@/core/typings/GitlabPipeline';
import { bridgeFixture } from './bridgeFixture';
import { userDetailsFixture } from './userDetailsFixture';

export const jobFixture: GitlabJob = {
  commit: {
    author_email: 'admin@example.com',
    author_name: 'Administrator',
    created_at: '2015-12-24T16:51:14.000+01:00',
    id: '0ff3ae198f8601a285adcf5c0fff204ee6fba5fd',
    message: 'Test the CI integration.',
    short_id: '0ff3ae19',
    title: 'Test the CI integration.',
  },
  coverage: null,
  allow_failure: false,
  created_at: '2015-12-24T15:51:21.802Z',
  started_at: '2015-12-24T17:54:27.722Z',
  finished_at: '2015-12-24T17:54:27.895Z',
  duration: 0.173,
  queued_duration: 0.01,
  artifacts: [],
  artifacts_expire_at: '2016-01-23T17:54:27.895Z',
  tag_list: ['docker runner', 'ubuntu18'],
  id: 7,
  name: 'chat',
  pipeline: {
    ...bridgeFixture.downstream_pipeline,
    project_id: 12,
  } as GitlabPipeline,
  ref: 'main',
  runner: null,
  stage: 'test',
  status: 'success',
  tag: false,
  web_url: 'https://example.com/foo/bar/-/jobs/7',
  user: userDetailsFixture,
};
