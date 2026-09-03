import { logger } from '@/core/services/logger';
import {
  buildEmailLocalParts,
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

describe('buildEmailLocalParts', () => {
  it('adds a stripped candidate when the username ends with digits', () => {
    expect(buildEmailLocalParts('firstname.lastname1')).toEqual([
      'firstname.lastname1',
      'firstname.lastname',
    ]);
  });

  it('strips a multi-digit trailing suffix', () => {
    expect(buildEmailLocalParts('firstname.lastname12')).toEqual([
      'firstname.lastname12',
      'firstname.lastname',
    ]);
  });

  it('returns only the username when it has no trailing digits', () => {
    expect(buildEmailLocalParts('axel.block')).toEqual(['axel.block']);
  });

  it('does not add a candidate that would end up empty or non-alphanumeric', () => {
    expect(buildEmailLocalParts('foo.1')).toEqual(['foo.1']);
    expect(buildEmailLocalParts('1234')).toEqual(['1234']);
  });
});

describe('fetchSlackUserFromGitlabUsername', () => {
  const lookupByEmail = slackBotWebClient.users.lookupByEmail as jest.Mock;

  it('returns undefined without calling Slack when the username is falsy', async () => {
    const result = await fetchSlackUserFromGitlabUsername(
      undefined as unknown as string,
    );

    expect(result).toBeUndefined();
    expect(lookupByEmail).not.toHaveBeenCalled();
  });

  it('tries the exact username against every domain before the stripped fallback', async () => {
    lookupByEmail
      .mockRejectedValueOnce(usersNotFoundError())
      .mockRejectedValueOnce(usersNotFoundError())
      .mockResolvedValueOnce({ user: slackUserFixture });

    const result = await fetchSlackUserFromGitlabUsername('root1');

    expect(result).toEqual(slackUserFixture);
    expect(lookupByEmail).toHaveBeenNthCalledWith(1, {
      email: 'root1@my-domain.com',
    });
    expect(lookupByEmail).toHaveBeenNthCalledWith(2, {
      email: 'root1@ext.my-domain.com',
    });
    expect(lookupByEmail).toHaveBeenNthCalledWith(3, {
      email: 'root@my-domain.com',
    });
  });

  it('logs at info when the match came from the suffix-stripped candidate', async () => {
    lookupByEmail
      .mockRejectedValueOnce(usersNotFoundError())
      .mockRejectedValueOnce(usersNotFoundError())
      .mockResolvedValueOnce({ user: slackUserFixture });

    await fetchSlackUserFromGitlabUsername('root1');

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'root1',
        email: slackUserFixture.profile.email,
      }),
      'slack user resolved from suffix-stripped username',
    );
  });

  it('does not log the fallback info line when the exact candidate matches', async () => {
    lookupByEmail.mockResolvedValueOnce({
      user: {
        ...slackUserFixture,
        profile: { ...slackUserFixture.profile, email: 'root@my-domain.com' },
      },
    });

    await fetchSlackUserFromGitlabUsername('root');

    expect(lookupByEmail).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
  });
});
