import type { GitlabTag } from '@/core/typings/GitlabTag';

export const tagFixture: GitlabTag = {
  commit: {
    id: '2695effb5807a22ff3d138d593fd856244e155e7',
    short_id: '2695effb',
    title: 'Initial commit',
    created_at: '2017-07-26T11:08:53.000+02:00',
    parent_ids: ['2a4b78934375d7f53875269ffd4f45fd83a84ebe'],
    message: 'Initial commit',
    author_name: 'John Smith',
    author_email: 'john@example.com',
    authored_date: '2012-05-28T04:42:42-07:00',
    committer_name: 'Jack Smith',
    committer_email: 'jack@example.com',
    committed_date: '2012-05-28T04:42:42-07:00',
  },
  release: {
    tag_name: '1.0.0',
    description: 'Amazing release. Wow',
  },
  name: 'stable-20200101-1000',
  target: '2695effb5807a22ff3d138d593fd856244e155e7',
  message: null,
  protected: true,
};
