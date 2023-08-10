export interface GitlabRelease {
  tag_name: string;
  description: string;
  name: string;
  created_at: string;
  released_at: string;
  author: {
    id: number;
    name: string;
    username: string;
    state: string;
    avatar_url: string;
    web_url: string;
  };
  commit: {
    id: string;
    short_id: string;
    title: string;
    created_at: string;
    parent_ids: string[];
    message: string;
    author_name: string;
    author_email: string;
    authored_date: string;
    committer_name: string;
    committer_email: string;
    committed_date: string;
  };
  milestones: {
    id: number;
    iid: number;
    project_id: number;
    title: string;
    description: string;
    state: string;
    created_at: string;
    updated_at: string;
    due_date: string;
    start_date: string;
    web_url: string;
    issue_stats: {
      total: number;
      closed: number;
    };
  }[];
  commit_path: string;
  tag_path: string;
  assets: {
    count: number;
    sources: { format: string; url: string }[];
    links: {
      id: number;
      name: string;
      url: string;
      external: boolean;
      link_type: string;
    }[];
  };
  evidences: { sha: string; filepath: string; collected_at: string }[];
}
