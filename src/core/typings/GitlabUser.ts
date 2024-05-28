export interface GitlabUser {
  avatar_url: string | null;
  id: number;
  /** ex: Josselin BUILS */
  name: string;
  state: 'active' | 'blocked';
  /** ex: josselin.buils */
  username: string;
  /** URL of user profile (ex: https://my-git.domain.com/firstname.lastname) */
  web_url: string;
}

export interface GitlabUserDetails extends GitlabUser {
  bio: string | null;
  bio_html: string;
  /** ex: 2018-12-12T18:40:30.864+01:00 */
  created_at: string;
  job_title: string;
  linkedin: string;
  location: string | null;
  organization: string;
  public_email: string;
  skype: string;
  twitter: string;
  website_url: string;
}
