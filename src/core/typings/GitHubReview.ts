/**
 * GitHub Pull Request Review types
 * Based on GitHub REST API v3
 * https://docs.github.com/en/rest/pulls/reviews
 */

import type { GitHubUser } from './GitHubUser';

export interface GitHubReview {
  id: number;
  user: GitHubUser;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED';
  body: string;
  submitted_at: string;
}
