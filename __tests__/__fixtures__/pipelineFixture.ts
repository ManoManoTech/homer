import type { GitlabPipeline } from '@/core/typings/GitlabPipeline';

export const pipelineFixture: GitlabPipeline = {
  id: 61,
  iid: 61,
  project_id: 1,
  sha: '384c444e840a515b23f21915ee5766b87068a70d',
  ref: 'master',
  source: 'push',
  status: 'pending',
  created_at: '2016-11-04T09:36:13.747Z',
  updated_at: '2016-11-04T09:36:13.977Z',
  web_url: 'https://example.com/foo/bar/pipelines/61',
};
