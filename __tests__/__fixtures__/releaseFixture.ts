import { tagFixture } from './tagFixture';

export const releaseFixture = {
  tag_name: tagFixture.name,
  description: 'Super nice release',
  name: 'New release',
  description_html: '\u003cp dir="auto"\u003eSuper nice release\u003c/p\u003e',
  created_at: '2019-01-03T02:22:45.118Z',
  released_at: '2019-01-03T02:22:45.118Z',
  author: {
    id: 1,
    name: 'Administrator',
    username: 'root',
    state: 'active',
    avatar_url:
      'https://www.gravatar.com/avatar/e64c7d89f26bd1972efa854d13d7dd61?s=80\u0026d=identicon',
    web_url: 'https://gitlab.example.com/root',
  },
  commit: tagFixture.commit,
  milestones: [
    {
      id: 51,
      iid: 1,
      project_id: 24,
      title: 'v1.0-rc',
      description: 'Voluptate fugiat possimus quis quod aliquam expedita.',
      state: 'closed',
      created_at: '2019-07-12T19:45:44.256Z',
      updated_at: '2019-07-12T19:45:44.256Z',
      due_date: '2019-08-16T11:00:00.256Z',
      start_date: '2019-07-30T12:00:00.256Z',
      web_url: 'https://gitlab.example.com/root/awesome-app/-/milestones/1',
      issue_stats: {
        total: 99,
        closed: 76,
      },
    },
    {
      id: 52,
      iid: 2,
      project_id: 24,
      title: 'v1.0',
      description: 'Voluptate fugiat possimus quis quod aliquam expedita.',
      state: 'closed',
      created_at: '2019-07-16T14:00:12.256Z',
      updated_at: '2019-07-16T14:00:12.256Z',
      due_date: '2019-08-16T11:00:00.256Z',
      start_date: '2019-07-30T12:00:00.256Z',
      web_url: 'https://gitlab.example.com/root/awesome-app/-/milestones/2',
      issue_stats: {
        total: 24,
        closed: 21,
      },
    },
  ],
  commit_path:
    '/root/awesome-app/commit/588440f66559714280628a4f9799f0c4eb880a4a',
  tag_path: '/root/awesome-app/-/tags/v0.11.1',
  evidence_sha: '760d6cdfb0879c3ffedec13af470e0f71cf52c6cde4d',
  assets: {
    count: 5,
    sources: [
      {
        format: 'zip',
        url: 'https://gitlab.example.com/root/awesome-app/-/archive/v0.3/awesome-app-v0.3.zip',
      },
      {
        format: 'tar.gz',
        url: 'https://gitlab.example.com/root/awesome-app/-/archive/v0.3/awesome-app-v0.3.tar.gz',
      },
      {
        format: 'tar.bz2',
        url: 'https://gitlab.example.com/root/awesome-app/-/archive/v0.3/awesome-app-v0.3.tar.bz2',
      },
      {
        format: 'tar',
        url: 'https://gitlab.example.com/root/awesome-app/-/archive/v0.3/awesome-app-v0.3.tar',
      },
    ],
    links: [
      {
        id: 3,
        name: 'hoge',
        url: 'https://gitlab.example.com/root/awesome-app/-/tags/v0.11.1/binaries/linux-amd64',
        external: true,
        link_type: 'other',
      },
    ],
    evidence_file_path:
      'https://gitlab.example.com/root/awesome-app/-/releases/v0.3/evidence.json',
  },
};
