/**
 * GitHub User types
 * Based on GitHub REST API v3
 * https://docs.github.com/en/rest/users/users
 */

export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
}
