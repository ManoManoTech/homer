/**
 * Unit tests for ProviderFactory
 *
 * Tests the factory that manages and provides access to repository providers
 */

import { GitHubProvider } from '@/core/services/providers/GitHubProvider';
import { GitLabProvider } from '@/core/services/providers/GitLabProvider';
import { ProviderFactory } from '@/core/services/providers/ProviderFactory';

describe('ProviderFactory', () => {
  beforeEach(() => {
    // Reset factory state between tests
    ProviderFactory.resetForTesting();
  });

  describe('getProvider', () => {
    it('should return GitLab provider for gitlab type', () => {
      const provider = ProviderFactory.getProvider('gitlab');

      expect(provider).toBeInstanceOf(GitLabProvider);
      expect(provider.type).toBe('gitlab');
    });

    it('should return GitHub provider for github type', () => {
      const provider = ProviderFactory.getProvider('github');

      expect(provider).toBeInstanceOf(GitHubProvider);
      expect(provider.type).toBe('github');
    });

    it('should throw error for unknown provider type', () => {
      expect(() => {
        ProviderFactory.getProvider('unknown' as any);
      }).toThrow();
    });

    it('should cache provider instances (singleton pattern)', () => {
      const provider1 = ProviderFactory.getProvider('gitlab');
      const provider2 = ProviderFactory.getProvider('gitlab');

      expect(provider1).toBe(provider2);
    });
  });

  describe('getProviderForProject', () => {
    it('should return GitLab provider for numeric project ID', () => {
      const provider = ProviderFactory.getProviderForProject(123);

      expect(provider).toBeInstanceOf(GitLabProvider);
      expect(provider.type).toBe('gitlab');
    });

    it('should return GitHub provider for string project ID (owner/repo format)', () => {
      const provider = ProviderFactory.getProviderForProject('owner/repo');

      expect(provider).toBeInstanceOf(GitHubProvider);
      expect(provider.type).toBe('github');
    });

    it('should handle project ID as string number (GitLab)', () => {
      const provider = ProviderFactory.getProviderForProject('123');

      expect(provider).toBeInstanceOf(GitLabProvider);
      expect(provider.type).toBe('gitlab');
    });
  });

  describe('detectProviderType', () => {
    it('should detect GitLab for numeric project ID', () => {
      const type = ProviderFactory.detectProviderType(123);
      expect(type).toBe('gitlab');
    });

    it('should detect GitLab for numeric string project ID', () => {
      const type = ProviderFactory.detectProviderType('456');
      expect(type).toBe('gitlab');
    });

    it('should detect GitHub for owner/repo format', () => {
      const type = ProviderFactory.detectProviderType('owner/repo');
      expect(type).toBe('github');
    });

    it('should detect GitHub for org/repo format', () => {
      const type = ProviderFactory.detectProviderType('my-org/my-repo');
      expect(type).toBe('github');
    });

    it('should default to GitLab for ambiguous cases', () => {
      const type = ProviderFactory.detectProviderType('something');
      expect(type).toBe('gitlab');
    });
  });

  describe('getAllProviders', () => {
    it('should return all available provider types', () => {
      const types = ProviderFactory.getAllProviderTypes();

      expect(types).toContain('gitlab');
      expect(types).toContain('github');
      expect(types.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isProviderAvailable', () => {
    it('should return true for GitLab provider', () => {
      const isAvailable = ProviderFactory.isProviderAvailable('gitlab');
      expect(isAvailable).toBe(true);
    });

    it('should return true for GitHub provider when token is set', () => {
      const isAvailable = ProviderFactory.isProviderAvailable('github');
      expect(isAvailable).toBe(true);
    });

    it('should return false for unknown provider', () => {
      const isAvailable = ProviderFactory.isProviderAvailable('unknown' as any);
      expect(isAvailable).toBe(false);
    });
  });

  describe('Environment variable handling', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should use GITLAB_URL and GITLAB_TOKEN from environment', () => {
      process.env.GITLAB_URL = 'https://gitlab.example.com';
      process.env.GITLAB_TOKEN = 'test-token';

      const provider = ProviderFactory.getProvider('gitlab') as GitLabProvider;

      expect(provider).toBeInstanceOf(GitLabProvider);
      // Provider should be created with env vars
    });

    it('should throw error if required env vars are missing', () => {
      delete process.env.GITLAB_URL;
      delete process.env.GITLAB_TOKEN;

      // Reset to force recreation
      ProviderFactory.resetForTesting();

      expect(() => {
        ProviderFactory.getProvider('gitlab');
      }).toThrow();
    });
  });

  describe('Provider interface compatibility', () => {
    it('should return providers that implement RepositoryProvider', () => {
      const provider = ProviderFactory.getProvider('gitlab');

      // Check that all required methods exist
      expect(typeof provider.fetchPullRequest).toBe('function');
      expect(typeof provider.searchPullRequests).toBe('function');
      expect(typeof provider.fetchApprovers).toBe('function');
      expect(typeof provider.fetchReviewers).toBe('function');
      expect(typeof provider.fetchAssignees).toBe('function');
      expect(typeof provider.fetchUser).toBe('function');
      expect(typeof provider.fetchCommits).toBe('function');
      expect(typeof provider.fetchPipelineStatus).toBe('function');
      expect(typeof provider.triggerPipeline).toBe('function');
      expect(typeof provider.fetchProject).toBe('function');
      expect(typeof provider.rebasePullRequest).toBe('function');
      expect(typeof provider.validateWebhookSignature).toBe('function');
      expect(typeof provider.parseWebhookEvent).toBe('function');
    });
  });

  describe('Error handling', () => {
    it('should provide helpful error for missing GitLab environment variables', () => {
      delete process.env.GITLAB_URL;
      ProviderFactory.resetForTesting();

      expect(() => {
        ProviderFactory.getProvider('gitlab');
      }).toThrow(/GITLAB_URL/);
    });

    it('should provide helpful error for missing GitHub environment variables', () => {
      delete process.env.GITHUB_TOKEN;
      ProviderFactory.resetForTesting();

      expect(() => {
        ProviderFactory.getProvider('github');
      }).toThrow(/GITHUB_TOKEN/);
    });
  });
});
