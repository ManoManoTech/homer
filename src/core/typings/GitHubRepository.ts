/**
 * GitHub Repository types
 * Based on GitHub REST API v3
 * https://docs.github.com/en/rest/repos/repos
 */

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  default_branch: string;
}
