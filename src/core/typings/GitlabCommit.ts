export interface GitlabCommit {
  author_email: string;
  author_name: string;
  authored_date: string;
  committed_date: string;
  committer_email: string;
  committer_name: string;
  created_at: string;
  id: string;
  message: string;
  parent_ids: string[];
  short_id: string;
  title: string;
  web_url: string;
}
