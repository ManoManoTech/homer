export type GitlabUser = {
  avatar_url: string | null;
  id: number;
  /** ex: Josselin BUILS */
  name: string;
  state: 'active' | 'blocked';
  /** ex: josselin.buils */
  username: string;
  /** URL of user profile (ex: https://git.manomano.tech/josselin.buils) */
  web_url: string;
};

export type GitlabUserDetail = GitlabUser & {
  /** ex: 2018-12-12T18:40:30.864+01:00 */
  created_at: string;
  bio: string;
  bio_html: string;
  job_title: string;
  linkedin: string;
  location: string | null;
  organization: string;
  public_email: string;
  skype: string;
  twitter: string;
  website_url: string;
};
