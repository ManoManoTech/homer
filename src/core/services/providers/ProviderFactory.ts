/**
 * Provider Factory
 *
 * Manages repository provider instances and provides access to the appropriate
 * provider based on project type or explicit provider type.
 *
 * Implements singleton pattern to ensure providers are reused across the application.
 */

import { logger } from '@/core/services/logger';
import type { RepositoryProvider } from '@/core/typings/RepositoryProvider';
import type { ProviderType } from '@/core/typings/UnifiedModels';
import { getEnvVariable } from '@/core/utils/getEnvVariable';
import { GitHubProvider } from './GitHubProvider';
import { GitLabProvider } from './GitLabProvider';

/**
 * Factory for creating and managing repository providers
 */
export class ProviderFactory {
  private static gitlabProvider: GitLabProvider | null = null;
  private static githubProvider: GitHubProvider | null = null;

  /**
   * Get provider instance by type
   *
   * @param type - Provider type ('gitlab' or 'github')
   * @returns Provider instance
   * @throws Error if provider is not implemented or required env vars are missing
   *
   * @example
   * const provider = ProviderFactory.getProvider('gitlab');
   * const pr = await provider.fetchPullRequest(123, 100);
   */
  static getProvider(type: ProviderType): RepositoryProvider {
    logger.debug({ type }, 'Getting provider');
    switch (type) {
      case 'gitlab':
        return this.getGitLabProvider();
      case 'github':
        return this.getGitHubProvider();
      default:
        logger.error({ type }, 'Unknown provider type requested');
        throw new Error(`Unknown provider type: ${type}`);
    }
  }

  /**
   * Get provider for a specific project
   *
   * Automatically detects the provider type based on the project ID format:
   * - Numeric or numeric string → GitLab
   * - String with "/" → GitHub (owner/repo format)
   *
   * @param projectId - Project identifier
   * @returns Provider instance
   *
   * @example
   * const provider = ProviderFactory.getProviderForProject(123); // GitLab
   * const provider = ProviderFactory.getProviderForProject('owner/repo'); // GitHub
   */
  static getProviderForProject(projectId: string | number): RepositoryProvider {
    const type = this.detectProviderType(projectId);
    logger.debug(
      {
        projectId,
        detectedType: type,
      },
      'Getting provider for project',
    );
    return this.getProvider(type);
  }

  /**
   * Detect provider type from project ID
   *
   * @param projectId - Project identifier
   * @returns Detected provider type
   *
   * @example
   * ProviderFactory.detectProviderType(123) // 'gitlab'
   * ProviderFactory.detectProviderType('owner/repo') // 'github'
   */
  static detectProviderType(projectId: string | number): ProviderType {
    // Numeric ID → GitLab
    if (typeof projectId === 'number') {
      return 'gitlab';
    }

    // String that's a number → GitLab
    if (/^\d+$/.test(projectId)) {
      return 'gitlab';
    }

    // String with "/" → GitHub (owner/repo format)
    if (projectId.includes('/')) {
      return 'github';
    }

    // Default to GitLab for ambiguous cases
    return 'gitlab';
  }

  /**
   * Get all available provider types
   *
   * @returns Array of provider types
   */
  static getAllProviderTypes(): ProviderType[] {
    return ['gitlab', 'github'];
  }

  /**
   * Check if a provider is available (implemented and configured)
   *
   * @param type - Provider type to check
   * @returns true if provider is available
   */
  static isProviderAvailable(type: ProviderType): boolean {
    try {
      switch (type) {
        case 'gitlab':
          // Check if required env vars exist
          return !!(process.env.GITLAB_URL && process.env.GITLAB_TOKEN);
        case 'github':
          // Check if required env vars exist
          return !!process.env.GITHUB_TOKEN;
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Get GitLab provider instance (singleton)
   */
  private static getGitLabProvider(): GitLabProvider {
    if (!this.gitlabProvider) {
      const gitlabUrl = getEnvVariable('GITLAB_URL');
      const gitlabToken = getEnvVariable('GITLAB_TOKEN');

      this.gitlabProvider = new GitLabProvider(gitlabUrl, gitlabToken);
    }

    return this.gitlabProvider;
  }

  /**
   * Get GitHub provider instance (singleton)
   */
  private static getGitHubProvider(): GitHubProvider {
    if (!this.githubProvider) {
      logger.info('Initializing GitHub provider');
      const githubToken = getEnvVariable('GITHUB_TOKEN');
      const githubUrl = 'https://api.github.com'; // GitHub API URL is fixed

      this.githubProvider = new GitHubProvider(githubUrl, githubToken);
      logger.info(
        {
          tokenConfigured: !!githubToken,
          tokenLength: githubToken?.length,
        },
        'GitHub provider initialized',
      );
    }

    return this.githubProvider;
  }

  /**
   * Reset factory state (for testing only)
   *
   * Clears cached provider instances to allow fresh creation
   */
  static resetForTesting(): void {
    this.gitlabProvider = null;
    this.githubProvider = null;
  }
}
