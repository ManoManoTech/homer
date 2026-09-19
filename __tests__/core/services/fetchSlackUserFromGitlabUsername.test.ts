import { CONFIG } from '@/config';
import {
  fetchSlackUserFromGitlabUser,
  fetchSlackUserFromGitlabUsername,
  slackBotWebClient,
} from '@/core/services/slack';
import { slackUserFixture } from '../../__fixtures__/slackUserFixture';

function usersNotFoundError(): Error {
  return Object.assign(new Error('An API error occurred: users_not_found'), {
    code: 'slack_webapi_platform_error',
    data: { ok: false, error: 'users_not_found' },
  });
}

/**
 * Characterizes the current `gitlabUsername -> "<username>@<domain>" per
 * EMAIL_DOMAINS -> users.lookupByEmail` resolution, before it is refactored
 * into a strategy chain. Domains are read from the same config the production
 * code uses, so the expectations track EMAIL_DOMAINS rather than hardcoding it.
 */
describe('fetchSlackUserFromGitlabUsername', () => {
  const lookupByEmail = slackBotWebClient.users.lookupByEmail as jest.Mock;
  const domains = CONFIG.slack.emailDomains.split(',');

  it('queries "<username>@<domain>" for each configured domain, in order', async () => {
    lookupByEmail.mockRejectedValue(usersNotFoundError());

    const result = await fetchSlackUserFromGitlabUsername('jane.doe');

    expect(result).toBeUndefined();
    expect(lookupByEmail).toHaveBeenCalledTimes(domains.length);
    domains.forEach((domain, index) => {
      expect(lookupByEmail).toHaveBeenNthCalledWith(index + 1, {
        email: `jane.doe@${domain}`,
      });
    });
  });

  it('returns the first matching Slack user and stops querying', async () => {
    lookupByEmail.mockResolvedValueOnce({ user: slackUserFixture });

    const result = await fetchSlackUserFromGitlabUsername('jane.doe');

    expect(result).toEqual(slackUserFixture);
    expect(lookupByEmail).toHaveBeenCalledTimes(1);
    expect(lookupByEmail).toHaveBeenNthCalledWith(1, {
      email: `jane.doe@${domains[0]}`,
    });
  });

  it('resolves to undefined when no domain yields a Slack user (graceful path)', async () => {
    lookupByEmail.mockRejectedValue(usersNotFoundError());

    await expect(
      fetchSlackUserFromGitlabUsername('ghost.user'),
    ).resolves.toBeUndefined();
  });

  it('resolves a GitlabUser through the same username-based lookup', async () => {
    lookupByEmail.mockResolvedValueOnce({ user: slackUserFixture });

    const result = await fetchSlackUserFromGitlabUser({
      username: 'jane.doe',
    } as any);

    expect(result).toEqual(slackUserFixture);
    expect(lookupByEmail).toHaveBeenNthCalledWith(1, {
      email: `jane.doe@${domains[0]}`,
    });
  });
});
