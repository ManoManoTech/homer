import { GitlabUserDetail } from '@/core/typings/GitlabUser';

export const userDetailsFixture: GitlabUserDetail = {
  id: 1,
  username: 'john_smith',
  name: 'John Smith',
  state: 'active',
  avatar_url: 'http://localhost:3000/uploads/user/avatar/1/cd8.jpeg',
  web_url: 'http://localhost:3000/john_smith',
  created_at: '2012-05-23T08:00:58Z',
  bio: '',
  bio_html: '',
  location: null,
  public_email: 'john@example.com',
  skype: '',
  linkedin: '',
  twitter: '',
  website_url: '',
  organization: '',
  job_title: 'Operations Specialist',
};
