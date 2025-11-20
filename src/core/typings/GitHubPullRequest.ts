/**
 * GitHub Pull Request types
 * Based on GitHub REST API v3
 * https://docs.github.com/en/rest/pulls/pulls
 */

import type { GitHubUser } from './GitHubUser';

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  closed_at: string | null;
  draft: boolean;
  merged: boolean;
  mergeable: boolean | null;
  mergeable_state: string;
  comments: number;
  changed_files: number;
  labels: Array<{ name: string }>;
}
