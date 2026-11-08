import { GitHubProvider } from '@/core/services/providers/GitHubProvider';
import { slackBotWebClient } from '@/core/services/slack';
import type { UnifiedUser } from '@/core/typings/UnifiedModels';
import { slackUserFixture } from '../__fixtures__/slackUserFixture';
import { mockGithubCall } from '../utils/mockGithubCall';

const user: UnifiedUser = {
  id: 1,
  username: 'Octocat',
  name: 'Octocat',
  webUrl: 'https://github.com/Octocat',
};

function mockSlackUser(email: string) {
  (slackBotWebClient.users.lookupByEmail as jest.Mock).mockImplementation(
    async (args: { email: string }) => {
      if (args.email !== email) {
        throw new Error('users_not_found');
      }
      return { user: slackUserFixture };
    },
  );
}

describe('github > Slack user', () => {
  it('should use the configured mapping first', async () => {
    // Given
    const provider = new GitHubProvider({ octocat: 'john.doe@corp.com' });
    mockGithubCall('/users/Octocat', { ...user, email: 'public@mail.com' });
    mockSlackUser('john.doe@corp.com');

    // When
    const slackUser = await provider.findSlackUser(user);

    // Then
    expect(slackUser).toEqual(slackUserFixture);
  });

  it('should use the GitHub public email', async () => {
    // Given
    const provider = new GitHubProvider();
    mockGithubCall('/users/Octocat', {
      login: 'Octocat',
      email: 'public@mail.com',
    });
    mockSlackUser('public@mail.com');

    // When
    const slackUser = await provider.findSlackUser(user);

    // Then
    expect(slackUser).toEqual(slackUserFixture);
  });

  it('should fall back to the login and email domains', async () => {
    // Given
    const provider = new GitHubProvider();
    mockGithubCall('/users/Octocat', { message: 'Not Found' }, 404);
    mockSlackUser('Octocat@ext.my-domain.com');

    // When
    const slackUser = await provider.findSlackUser(user);

    // Then
    expect(slackUser).toEqual(slackUserFixture);
  });

  it('should return undefined when nothing matches', async () => {
    // Given
    const provider = new GitHubProvider();
    mockGithubCall('/users/Octocat', { login: 'Octocat', email: null });
    mockSlackUser('nobody@mail.com');

    // When
    const slackUser = await provider.findSlackUser(user);

    // Then
    expect(slackUser).toBeUndefined();
  });
});
