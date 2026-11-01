import slackifyMarkdown from 'slackify-markdown';
import request from 'supertest';
import { app } from '@/app';
import { CONFIG } from '@/config';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { addReviewToChannel } from '@/core/services/data';
import { logger } from '@/core/services/logger';
import { slackBotWebClient } from '@/core/services/slack';
import { loadUserIdentityResolvers } from '@/core/services/userIdentity';
import { mergeRequestHookFixture } from '../__fixtures__/hooks/mergeRequestHookFixture';
import { mergeRequestDetailsFixture } from '../__fixtures__/mergeRequestDetailsFixture';
import {
  answerGitUsernameWith,
  answerWith,
} from '../__fixtures__/plugins/identity/configurableDirectory';
import { slackUserFixture } from '../__fixtures__/slackUserFixture';
import { getGitlabHeaders } from '../utils/getGitlabHeaders';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockBuildReviewMessageCalls } from '../utils/mockBuildReviewMessageCalls';
import { mockGitlabCall } from '../utils/mockGitlabCall';
import { waitFor } from '../utils/waitFor';

const TEST_PLUGIN_DIRECTORY = '@root/__tests__/__fixtures__/plugins/identity';
const TEST_RESOLVER_TIMEOUT_MS = 20;

function slackApiError(error: string): Error {
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

// When the approver isn't found on Slack, Homer answers 204 and posts nothing.
function expectNoApprovalNotification(response: request.Response) {
  expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
  expect(slackBotWebClient.chat.postMessage).not.toHaveBeenCalled();
}

const CONVENTION_EMAIL_DOMAIN = CONFIG.slack.emailDomains.split(',')[0];

// The channel shares one merge request authored by the GitLab user `jdoe`, so
// the list is personalized ("Your merge requests") only when Homer finds out
// that the Slack user running the command is `jdoe`.
async function listReviewsAs(slackUser: { id: string; email?: string }) {
  const body = {
    channel_id: 'channelId',
    text: 'review list',
    user_id: slackUser.id,
  };

  await addReviewToChannel({
    channelId: 'channelId',
    mergeRequestIid: 1,
    projectId: 1,
    ts: 'ts',
  });
  mockGitlabCall('/projects/1/merge_requests/1', {
    ...mergeRequestDetailsFixture,
    author: { ...mergeRequestDetailsFixture.author, username: 'jdoe' },
    title: 'work of jdoe',
  });
  (slackBotWebClient.users.info as jest.Mock).mockResolvedValue({
    user: {
      ...slackUserFixture,
      id: slackUser.id,
      profile: { ...slackUserFixture.profile, email: slackUser.email },
    },
  });
  (slackBotWebClient.chat.getPermalink as jest.Mock).mockReturnValue({
    permalink: 'https://slack/ts',
  });

  return request(app)
    .post('/api/v1/homer/command')
    .set(getSlackHeaders(body))
    .send(body);
}

// The list is posted after Homer has answered Slack, so wait for it.
async function expectReviewListHeading(heading: string) {
  await waitFor(() =>
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: slackifyMarkdown(
                `**${heading}:**\n- [work of jdoe](https://slack/ts)`,
              ),
            },
          },
        ],
      }),
    ),
  );
}

const expectPersonalizedForJdoe = () =>
  expectReviewListHeading('Your merge requests');
const expectNotPersonalized = () => expectReviewListHeading('Ongoing reviews');

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
            return Promise.reject(slackApiError('users_not_found'));
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
        slackApiError('user_not_found'),
      );
      await loadUserIdentityResolvers(
        ['slackIdDirectory', 'emailDomainConvention'],
        TEST_PLUGIN_DIRECTORY,
      );

      const response = await approveMergeRequestAs('root');

      expect(response.status).toEqual(HTTP_STATUS_OK);
      expectApprovalThreadMessageFrom('root.real');
    });

    it('treats a null answer as an unknown user', async () => {
      answerWith(null);
      await loadUserIdentityResolvers(
        ['configurableDirectory', 'emailDomainConvention'],
        TEST_PLUGIN_DIRECTORY,
      );

      const response = await approveMergeRequestAs('root');

      expect(response.status).toEqual(HTTP_STATUS_OK);
      expectApprovalThreadMessageFrom('root.real');
    });

    it('leaves the user out instead of trying the next resolver when a plugin throws', async () => {
      await loadUserIdentityResolvers(
        ['brokenDirectory', 'emailDomainConvention'],
        TEST_PLUGIN_DIRECTORY,
      );

      const response = await approveMergeRequestAs('root');

      expectNoApprovalNotification(response);
    });

    it.each([
      ['emails is null', { emails: null }],
      ['emails is a string', { emails: 'root.company@corp.test' }],
      ['emails contains a non-string', { emails: [42] }],
      ['chatUserId is not a string', { chatUserId: 42 }],
      ['the answer is a string', 'root.company@corp.test'],
      ['the answer is an array', ['root.company@corp.test']],
    ])(
      'leaves the user out instead of trying the next resolver when %s',
      async (_, answer) => {
        answerWith(answer);
        await loadUserIdentityResolvers(
          ['configurableDirectory', 'emailDomainConvention'],
          TEST_PLUGIN_DIRECTORY,
        );

        const response = await approveMergeRequestAs('root');

        expectNoApprovalNotification(response);
      },
    );

    it('logs which plugin returned an invalid identity', async () => {
      answerWith({ emails: null });
      await loadUserIdentityResolvers(
        ['configurableDirectory', 'emailDomainConvention'],
        TEST_PLUGIN_DIRECTORY,
      );

      await approveMergeRequestAs('root');

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          resolver: 'configurableDirectory',
          identity: { emails: null },
        }),
        'user identity resolver returned an invalid identity',
      );
    });

    it('leaves the user out instead of trying the next resolver when Slack fails to look up the email', async () => {
      const lookUpByLocalPart = (
        slackBotWebClient.users.lookupByEmail as jest.Mock
      ).getMockImplementation()!;
      (slackBotWebClient.users.lookupByEmail as jest.Mock).mockImplementation(
        (args: { email: string }) =>
          args.email === 'root.company@corp.test'
            ? Promise.reject(slackApiError('ratelimited'))
            : lookUpByLocalPart(args),
      );
      await loadUserIdentityResolvers(
        ['companyDirectory', 'emailDomainConvention'],
        TEST_PLUGIN_DIRECTORY,
      );

      const response = await approveMergeRequestAs('root');

      expectNoApprovalNotification(response);
    });

    it('leaves the user out instead of trying the next resolver when Slack fails to look up the user id', async () => {
      (slackBotWebClient.users.info as jest.Mock).mockRejectedValue(
        slackApiError('ratelimited'),
      );
      await loadUserIdentityResolvers(
        ['slackIdDirectory', 'emailDomainConvention'],
        TEST_PLUGIN_DIRECTORY,
      );

      const response = await approveMergeRequestAs('root');

      expectNoApprovalNotification(response);
    });

    it('leaves the user out instead of trying the next resolver when a plugin does not answer in time', async () => {
      await loadUserIdentityResolvers(
        ['hangingDirectory', 'emailDomainConvention'],
        TEST_PLUGIN_DIRECTORY,
        TEST_RESOLVER_TIMEOUT_MS,
      );

      const response = await approveMergeRequestAs('root');

      expectNoApprovalNotification(response);
    });

    it('logs which plugin did not answer in time', async () => {
      await loadUserIdentityResolvers(
        ['hangingDirectory', 'emailDomainConvention'],
        TEST_PLUGIN_DIRECTORY,
        TEST_RESOLVER_TIMEOUT_MS,
      );

      await approveMergeRequestAs('root');

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          resolver: 'hangingDirectory',
          err: expect.objectContaining({
            message: `user identity resolver did not answer within ${TEST_RESOLVER_TIMEOUT_MS} ms`,
          }),
        }),
        'user identity resolver failed',
      );
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

  describe('when finding the GitLab user behind a Slack user', () => {
    it('personalizes the review list for the git user a company plugin finds by email', async () => {
      await loadUserIdentityResolvers(
        ['companyDirectory'],
        TEST_PLUGIN_DIRECTORY,
      );

      const response = await listReviewsAs({
        id: 'U_JANE',
        email: 'jane.doe@corp.test',
      });

      expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
      await expectPersonalizedForJdoe();
    });

    it('personalizes the review list for the git user a company plugin finds by Slack user id', async () => {
      await loadUserIdentityResolvers(
        ['slackIdDirectory'],
        TEST_PLUGIN_DIRECTORY,
      );

      await listReviewsAs({ id: 'U_JANE' });

      await expectPersonalizedForJdoe();
    });

    it('moves to the next resolver when a plugin does not know the Slack user', async () => {
      await loadUserIdentityResolvers(
        ['companyDirectory', 'emailDomainConvention'],
        TEST_PLUGIN_DIRECTORY,
      );

      await listReviewsAs({
        id: 'U_JDOE',
        email: `jdoe@${CONVENTION_EMAIL_DOMAIN}`,
      });

      await expectPersonalizedForJdoe();
    });

    it('treats a null git username as an unknown Slack user', async () => {
      answerGitUsernameWith(null);
      await loadUserIdentityResolvers(
        ['configurableDirectory', 'emailDomainConvention'],
        TEST_PLUGIN_DIRECTORY,
      );

      await listReviewsAs({
        id: 'U_JDOE',
        email: `jdoe@${CONVENTION_EMAIL_DOMAIN}`,
      });

      await expectPersonalizedForJdoe();
    });

    it('does not personalize the review list when a resolver has no reverse lookup', async () => {
      await loadUserIdentityResolvers(
        ['forwardOnlyDirectory', 'emailDomainConvention'],
        TEST_PLUGIN_DIRECTORY,
      );

      await listReviewsAs({
        id: 'U_JDOE',
        email: `jdoe@${CONVENTION_EMAIL_DOMAIN}`,
      });

      await expectNotPersonalized();
    });

    it('does not personalize the review list when a plugin throws', async () => {
      await loadUserIdentityResolvers(
        ['brokenDirectory', 'emailDomainConvention'],
        TEST_PLUGIN_DIRECTORY,
      );

      await listReviewsAs({
        id: 'U_JDOE',
        email: `jdoe@${CONVENTION_EMAIL_DOMAIN}`,
      });

      await expectNotPersonalized();
    });

    it('does not personalize the review list when a plugin does not answer in time', async () => {
      await loadUserIdentityResolvers(
        ['hangingDirectory', 'emailDomainConvention'],
        TEST_PLUGIN_DIRECTORY,
        TEST_RESOLVER_TIMEOUT_MS,
      );

      await listReviewsAs({
        id: 'U_JDOE',
        email: `jdoe@${CONVENTION_EMAIL_DOMAIN}`,
      });

      await expectNotPersonalized();
    });

    it.each([
      ['a number', 42],
      ['an empty string', ''],
      ['an object', { username: 'jdoe' }],
      ['an array', ['jdoe']],
    ])(
      'does not personalize the review list when a plugin returns %s as git username',
      async (_, answer) => {
        answerGitUsernameWith(answer);
        await loadUserIdentityResolvers(
          ['configurableDirectory', 'emailDomainConvention'],
          TEST_PLUGIN_DIRECTORY,
        );

        await listReviewsAs({
          id: 'U_JDOE',
          email: `jdoe@${CONVENTION_EMAIL_DOMAIN}`,
        });

        await expectNotPersonalized();
      },
    );

    it('logs which plugin failed to find the git user', async () => {
      await loadUserIdentityResolvers(
        ['brokenDirectory', 'emailDomainConvention'],
        TEST_PLUGIN_DIRECTORY,
      );

      await listReviewsAs({
        id: 'U_JDOE',
        email: `jdoe@${CONVENTION_EMAIL_DOMAIN}`,
      });

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

    it('rejects a plugin whose findGitUsername is not a function', async () => {
      await expect(
        loadUserIdentityResolvers(
          ['invalidReverseDirectory'],
          TEST_PLUGIN_DIRECTORY,
        ),
      ).rejects.toThrow(
        'Cannot load user identity resolver "invalidReverseDirectory": findGitUsername must be a function when it is provided.',
      );
    });

    it('rejects an empty list of resolvers', async () => {
      await expect(loadUserIdentityResolvers([])).rejects.toThrow(
        'At least one user identity resolver must be configured.',
      );
    });
  });
});
