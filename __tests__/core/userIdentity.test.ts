import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_OK } from '@/constants';
import { addReviewToChannel } from '@/core/services/data';
import { logger } from '@/core/services/logger';
import { slackBotWebClient } from '@/core/services/slack';
import { loadUserIdentityResolvers } from '@/core/services/userIdentity';
import { mergeRequestHookFixture } from '../__fixtures__/hooks/mergeRequestHookFixture';
import { getGitlabHeaders } from '../utils/getGitlabHeaders';
import { mockBuildReviewMessageCalls } from '../utils/mockBuildReviewMessageCalls';

const TEST_PLUGIN_DIRECTORY = '@root/__tests__/__fixtures__/plugins/identity';

function slackNotFoundError(error: string): Error {
  return Object.assign(new Error(`An API error occurred: ${error}`), {
    code: 'slack_webapi_platform_error',
    data: { ok: false, error },
  });
}

async function approveMergeRequestAs(username: string) {
  const { object_attributes, project, user } = mergeRequestHookFixture;

  await addReviewToChannel({
    channelId: 'channelId',
    mergeRequestIid: object_attributes.iid,
    projectId: project.id,
    ts: 'ts',
  });
  mockBuildReviewMessageCalls();

  return request(app)
    .post('/api/v1/homer/gitlab')
    .set(getGitlabHeaders())
    .send({
      ...mergeRequestHookFixture,
      object_attributes: { ...object_attributes, action: 'approved' },
      user: { ...user, username },
    });
}

function expectApprovalThreadMessageFrom(realName: string) {
  expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith({
    channel: 'channelId',
    icon_emoji: ':thumbsup_blue:',
    text: `*${realName}* has approved this merge request.`,
    thread_ts: 'ts',
  });
}

describe('user identity resolvers', () => {
  beforeEach(() => {
    (slackBotWebClient.users.lookupByEmail as jest.Mock).mockImplementation(
      ({ email }: { email: string }) => {
        const name = email.split('@')[0];
        return Promise.resolve({
          user: {
            name,
            profile: { image_72: 'image_72' },
            real_name: `${name}.real`,
          },
        });
      },
    );
    (slackBotWebClient.users.info as jest.Mock).mockResolvedValue({
      user: {
        name: 'root.from.id',
        profile: { image_72: 'image_72' },
        real_name: 'Root From Id',
      },
    });
    (slackBotWebClient.chat.postMessage as jest.Mock).mockResolvedValue({
      ts: 'ts',
    });
  });

  afterEach(async () => {
    await loadUserIdentityResolvers(['emailDomainConvention']);
  });

  describe('when finding the Slack user behind a merge request event', () => {
    it('uses the Slack user found with the email returned by a company plugin', async () => {
      await loadUserIdentityResolvers(
        ['companyDirectory'],
        TEST_PLUGIN_DIRECTORY,
      );

      const response = await approveMergeRequestAs('root');

      expect(response.status).toEqual(HTTP_STATUS_OK);
      expectApprovalThreadMessageFrom('root.company.real');
    });

    it('uses the Slack user id returned by a company plugin', async () => {
      await loadUserIdentityResolvers(
        ['slackIdDirectory'],
        TEST_PLUGIN_DIRECTORY,
      );

      const response = await approveMergeRequestAs('root');

      expect(response.status).toEqual(HTTP_STATUS_OK);
      expectApprovalThreadMessageFrom('Root From Id');
    });

    it('moves to the next resolver when a plugin does not know the user', async () => {
      await loadUserIdentityResolvers(
        ['companyDirectory', 'emailDomainConvention'],
        TEST_PLUGIN_DIRECTORY,
      );

      const response = await approveMergeRequestAs('jane.doe');

      expect(response.status).toEqual(HTTP_STATUS_OK);
      expectApprovalThreadMessageFrom('jane.doe.real');
    });

    it('moves to the next resolver when the email returned by a plugin is not a Slack user', async () => {
      (slackBotWebClient.users.lookupByEmail as jest.Mock).mockImplementation(
        ({ email }: { email: string }) => {
          if (email === 'root.company@corp.test') {
            return Promise.reject(slackNotFoundError('users_not_found'));
          }
          const name = email.split('@')[0];
          return Promise.resolve({
            user: {
              name,
              profile: { image_72: 'image_72' },
              real_name: `${name}.real`,
            },
          });
        },
      );
      await loadUserIdentityResolvers(
        ['companyDirectory', 'emailDomainConvention'],
        TEST_PLUGIN_DIRECTORY,
      );

      const response = await approveMergeRequestAs('root');

      expect(response.status).toEqual(HTTP_STATUS_OK);
      expectApprovalThreadMessageFrom('root.real');
    });

    it('moves to the next resolver when the Slack user id returned by a plugin is not found', async () => {
      (slackBotWebClient.users.info as jest.Mock).mockRejectedValue(
        slackNotFoundError('user_not_found'),
      );
      await loadUserIdentityResolvers(
        ['slackIdDirectory', 'emailDomainConvention'],
        TEST_PLUGIN_DIRECTORY,
      );

      const response = await approveMergeRequestAs('root');

      expect(response.status).toEqual(HTTP_STATUS_OK);
      expectApprovalThreadMessageFrom('root.real');
    });

    it('moves to the next resolver when a plugin throws', async () => {
      await loadUserIdentityResolvers(
        ['brokenDirectory', 'emailDomainConvention'],
        TEST_PLUGIN_DIRECTORY,
      );

      const response = await approveMergeRequestAs('root');

      expect(response.status).toEqual(HTTP_STATUS_OK);
      expectApprovalThreadMessageFrom('root.real');
    });

    it('logs which plugin threw', async () => {
      await loadUserIdentityResolvers(
        ['brokenDirectory', 'emailDomainConvention'],
        TEST_PLUGIN_DIRECTORY,
      );

      await approveMergeRequestAs('root');

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          resolver: 'brokenDirectory',
          err: expect.objectContaining({ message: 'directory unavailable' }),
        }),
        'user identity resolver failed',
      );
    });
  });

  describe('when loading resolvers', () => {
    it('rejects a name that matches neither a built-in resolver nor a plugin', async () => {
      await expect(
        loadUserIdentityResolvers(['missingDirectory'], TEST_PLUGIN_DIRECTORY),
      ).rejects.toThrow(
        `Cannot load user identity resolver "missingDirectory" from ${TEST_PLUGIN_DIRECTORY}/missingDirectory`,
      );
    });

    it('rejects a plugin whose default export has no resolve function', async () => {
      await expect(
        loadUserIdentityResolvers(['notAResolver'], TEST_PLUGIN_DIRECTORY),
      ).rejects.toThrow(
        'Cannot load user identity resolver "notAResolver": its default export must have a resolve function.',
      );
    });

    it('rejects an empty list of resolvers', async () => {
      await expect(loadUserIdentityResolvers([])).rejects.toThrow(
        'At least one user identity resolver must be configured.',
      );
    });
  });
});
