import { GitlabBridge } from '@/core/typings/GitlabBridge';
import { pipelineFixture } from './pipelineFixture';
import { userDetailsFixture } from './userDetailsFixture';

export const bridgeFixture: GitlabBridge = {
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
  finished_at: '2015-12-24T17:58:27.895Z',
  duration: 240,
  queued_duration: 0.123,
  id: 7,
  name: 'launch_fr_b2c',
  pipeline: pipelineFixture,
  ref: 'main',
  stage: 'test',
  status: 'pending',
  tag: false,
  web_url: 'https://example.com/foo/bar/-/jobs/7',
  user: userDetailsFixture,
  downstream_pipeline: {
    id: 5,
    sha: 'f62a4b2fb89754372a346f24659212eb8da13601',
    ref: 'main',
    status: 'pending',
    created_at: '2015-12-24T17:54:27.722Z',
    updated_at: '2015-12-24T17:58:27.896Z',
    web_url: 'https://example.com/diaspora/diaspora-client/pipelines/5',
  },
};
