import type { ProviderType } from '@/core/typings/UnifiedModels';

/**
 * Parsed provider URL information
 */
export interface ParsedProviderUrl {
  /** Provider type (github or gitlab) */
  provider: ProviderType;
  /** Project identifier (owner/repo for GitHub, path for GitLab) */
  projectId: string;
  /** Pull request or merge request number */
  number: number;
  /** Original URL */
  url: string;
}

/**
 * Parse a GitHub or GitLab URL to extract provider info and PR/MR details
 *
 * @param query - The search query that might be a URL
 * @returns Parsed URL information, or null if not a valid PR/MR URL
 *
 * @example
 * // GitHub URL
 * parseProviderUrl('https://github.com/owner/repo/pull/123')
 * // Returns: { provider: 'github', projectId: 'owner/repo', number: 123, url: '...' }
 *
 * @example
 * // GitLab URL
 * parseProviderUrl('https://gitlab.com/org/project/-/merge_requests/456')
 * // Returns: { provider: 'gitlab', projectId: 'org/project', number: 456, url: '...' }
 *
 * @example
 * // Not a URL
 * parseProviderUrl('fix: bug #123')
 * // Returns: null
 */
export function parseProviderUrl(query: string): ParsedProviderUrl | null {
  // Try parsing as GitHub URL
  // Format: https://github.com/owner/repo/pull/123
  const githubMatch = query.match(
    /^https?:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/i
  );

  if (githubMatch) {
    return {
      provider: 'github',
      projectId: githubMatch[1], // owner/repo
      number: parseInt(githubMatch[2], 10),
      url: query,
    };
  }

  // Try parsing as GitLab URL
  // Format: https://gitlab.com/org/repo/-/merge_requests/123
  // or https://gitlab.example.com/group/subgroup/project/-/merge_requests/123
  const gitlabMatch = query.match(
    /^https?:\/\/[^/]+\/(.+)\/-\/merge_requests\/(\d+)/i
  );

  if (gitlabMatch) {
    return {
      provider: 'gitlab',
      projectId: gitlabMatch[1], // Full project path (org/repo or group/subgroup/project)
      number: parseInt(gitlabMatch[2], 10),
      url: query,
    };
  }

  // Not a recognized PR/MR URL
  return null;
}
