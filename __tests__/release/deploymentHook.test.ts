import type { SectionBlock } from '@slack/types/dist/block-kit/blocks';
import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { createRelease, updateRelease } from '@/core/services/data';
import { fetchDeploymentById } from '@/core/services/gitlab';
import { slackBotWebClient } from '@/core/services/slack';
import type { DataRelease } from '@/core/typings/Data';
import type { GitlabDeploymentStatus } from '@/core/typings/GitlabDeployment';
import type { GitlabDeploymentHook } from '@/core/typings/GitlabDeploymentHook';
import type { ReleaseStateUpdate } from '@/release/typings/ReleaseStateUpdate';
import ConfigHelper from '@/release/utils/ConfigHelper';
import {
  cancelReleaseButton,
  getReleaseCompletedMessageFixture,
  getReleaseUpdateMessageFixture,
} from '@root/__tests__/__fixtures__/releaseMessage';
import { getGitlabHeaders } from '@root/__tests__/utils/getGitlabHeaders';
import { deploymentFixture } from '../__fixtures__/deploymentFixture';
import { deploymentHookFixture } from '../__fixtures__/hooks/deploymentHookFixture';
import { projectFixture } from '../__fixtures__/projectFixture';
import { slackUserFixture } from '../__fixtures__/slackUserFixture';

// Mock the gitlab service functions
jest.mock('@/core/services/gitlab', () => ({
  fetchDeploymentById: jest.fn(),
}));

// Mock the ConfigHelper
jest.mock('@/release/utils/ConfigHelper', () => ({
  __esModule: true,
  default: {
    hasProjectReleaseConfig: jest.fn(),
    getProjectReleaseConfig: jest.fn(),
  },
}));

const initialMockRelease: DataRelease = {
  description:
    '- [feat(great): implement great feature](http://gitlab.example.com/my-group/my-project/-/merge_requests/1) - [SPAR-156](https://my-ticket-management.com/view/SPAR-156)\n- [feat(great): implement another great feature](http://gitlab.example.com/my-group/my-project/-/merge_requests/1) - [SPAR-158](https://my-ticket-management.com/view/SPAR-158)',
  failedDeployments: [],
  projectId: projectFixture.id,
  slackAuthor: slackUserFixture,
  startedDeployments: [],
  state: 'created',
  successfulDeployments: [],
  tagName: deploymentFixture.ref,
  ts: 'timestamp',
};

function mockProjectReleaseConfig(releaseStateUpdates: ReleaseStateUpdate[]) {
  (ConfigHelper.getProjectReleaseConfig as jest.Mock).mockResolvedValue({
    notificationChannelIds: ['notification-channel-1'],
    releaseChannelId: 'release-channel',
    releaseManager: {
      getReleaseStateUpdate: jest.fn().mockResolvedValue(releaseStateUpdates),
    },
  });
}

describe('release > deploymentHookHandler', () => {
  beforeEach(async () => {
    jest.clearAllMocks();

    // Default mock implementations
    (ConfigHelper.hasProjectReleaseConfig as jest.Mock).mockResolvedValue(true);
    mockProjectReleaseConfig([]);

    (slackBotWebClient.chat.postMessage as jest.Mock).mockResolvedValue({});
    (slackBotWebClient.chat.update as jest.Mock).mockResolvedValue({});

    (fetchDeploymentById as jest.Mock).mockResolvedValue(deploymentFixture);

    const createdRelease = await createRelease(initialMockRelease);
    await updateRelease(
      createdRelease.projectId,
      createdRelease.tagName,
      () => ({
        state: 'created',
        ts: initialMockRelease.ts,
      }),
    );
  });

  it('should return 204 if project has no release config', async () => {
    // Given
    (ConfigHelper.hasProjectReleaseConfig as jest.Mock).mockResolvedValue(
      false,
    );

    // When
    const response = await triggerGitlabDeploymentHook(deploymentHookFixture);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
  });

  it('should return 204 if status is not in STATUSES_TO_HANDLE', async () => {
    // Given
    const hook = {
      ...deploymentHookFixture,
      status: 'canceled' as GitlabDeploymentStatus,
    };

    // When
    const response = await triggerGitlabDeploymentHook(hook);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
  });

  it('should return 204 if release does not exist', async () => {
    // Given
    (fetchDeploymentById as jest.Mock).mockResolvedValue({
      ...deploymentFixture,
      ref: 'unknown',
    });

    // When
    const response = await triggerGitlabDeploymentHook(deploymentHookFixture);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
  });

  it('should update release with failed deployment status', async () => {
    // Given
    const hook = {
      ...deploymentHookFixture,
      environment: 'staging',
      status_changed_at: '2021-04-28 21:50:00 +0200',
      status: 'failed' as GitlabDeploymentStatus,
    };

    // When
    const response = await triggerGitlabDeploymentHook(hook);

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(
      await hasModelEntry('Release', {
        projectId: initialMockRelease.projectId,
        tagName: initialMockRelease.tagName,
        failedDeployments: JSON.stringify([
          { environment: hook.environment, date: hook.status_changed_at },
        ]),
      }),
    ).toEqual(true);
  });

  it('should update release with running deployment status', async () => {
    // Given
    const hook = {
      ...deploymentHookFixture,
      environment: 'staging',
      status_changed_at: '2021-04-28 21:50:00 +0200',
      status: 'running' as GitlabDeploymentStatus,
    };

    // When
    const response = await triggerGitlabDeploymentHook(hook);

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(
      await hasModelEntry('Release', {
        projectId: initialMockRelease.projectId,
        tagName: initialMockRelease.tagName,
        startedDeployments: JSON.stringify([
          { environment: hook.environment, date: hook.status_changed_at },
        ]),
      }),
    ).toEqual(true);
  });

  it('should update release with success deployment status', async () => {
    // Given
    const hook = {
      ...deploymentHookFixture,
      environment: 'staging',
      status_changed_at: '2021-04-28 21:50:00 +0200',
      status: 'success' as GitlabDeploymentStatus,
    };

    // When
    const response = await triggerGitlabDeploymentHook(hook);

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(
      await hasModelEntry('Release', {
        projectId: initialMockRelease.projectId,
        tagName: initialMockRelease.tagName,
        successfulDeployments: JSON.stringify([
          { environment: hook.environment, date: hook.status_changed_at },
        ]),
      }),
    ).toEqual(true);
  });

  it('should update release with monitoring deployment status', async () => {
    // Given
    const releaseStateUpdates: ReleaseStateUpdate[] = [
      { environment: 'production', deploymentState: 'monitoring' },
    ];
    mockProjectReleaseConfig(releaseStateUpdates);

    const hook = {
      ...deploymentHookFixture,
      environment: 'production',
      status_changed_at: '2021-04-28 21:50:00 +0200',
      status: 'success' as GitlabDeploymentStatus,
    };

    // When
    const response = await triggerGitlabDeploymentHook(hook);

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(
      await hasModelEntry('Release', {
        projectId: initialMockRelease.projectId,
        tagName: initialMockRelease.tagName,
        state: 'monitoring',
        successfulDeployments: JSON.stringify([
          { environment: hook.environment, date: hook.status_changed_at },
        ]),
      }),
    ).toEqual(true);
  });

  it('integration release state is deploying > should update notification', async () => {
    const releaseStateUpdates: ReleaseStateUpdate[] = [
      { environment: 'integration', deploymentState: 'deploying' },
    ];

    mockProjectReleaseConfig(releaseStateUpdates);

    // When
    const response = await triggerGitlabDeploymentHook({
      ...deploymentHookFixture,
      status: 'running',
      environment: 'integration',
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith({
      channel: 'notification-channel-1',
      icon_url: slackUserFixture.profile.image_72,
      username: slackUserFixture.real_name,
      link_names: true,
      text: `:rocket: ${deploymentHookFixture.project.name} INT`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:rocket: ${deploymentHookFixture.project.name} INT - <${deploymentFixture.deployable.pipeline.web_url}|pipeline> - <${deploymentHookFixture.project.web_url}/-/releases/${deploymentFixture.ref}|release notes>`,
          },
        },
      ],
    });
    expect(slackBotWebClient.chat.update).toHaveBeenCalledTimes(1); // For the release channel
    expect(slackBotWebClient.chat.update).toHaveBeenCalledWith(
      getReleaseUpdateMessageFixture(
        'release-channel',
        deploymentFixture.ref,
        initialMockRelease.ts!,
        [
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '⏳ *Integration:* Deployment started <!date^1619639400^at {time} on {date_short_pretty}|now>',
              },
            ],
          },
          cancelReleaseButton(
            initialMockRelease.projectId,
            initialMockRelease.tagName,
          ),
        ],
      ),
    );
  });

  it('staging release state is deploying > should update notification', async () => {
    const releaseStateUpdates: ReleaseStateUpdate[] = [
      { environment: 'staging', deploymentState: 'deploying' },
    ];

    mockProjectReleaseConfig(releaseStateUpdates);

    // When
    const response = await triggerGitlabDeploymentHook({
      ...deploymentHookFixture,
      status: 'running',
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith({
      channel: 'notification-channel-1',
      icon_url: slackUserFixture.profile.image_72,
      username: slackUserFixture.real_name,
      link_names: true,
      text: `:rocket: ${deploymentHookFixture.project.name} STG`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:rocket: ${deploymentHookFixture.project.name} STG - <${deploymentFixture.deployable.pipeline.web_url}|pipeline> - <${deploymentHookFixture.project.web_url}/-/releases/${deploymentFixture.ref}|release notes>`,
          },
        },
      ],
    });
    expect(slackBotWebClient.chat.update).toHaveBeenCalledTimes(1); // For the release channel
    expect(slackBotWebClient.chat.update).toHaveBeenCalledWith(
      getReleaseUpdateMessageFixture(
        'release-channel',
        deploymentFixture.ref,
        initialMockRelease.ts!,
        [
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '⏳ *Staging:* Deployment started <!date^1619639400^at {time} on {date_short_pretty}|now>',
              },
            ],
          },
          cancelReleaseButton(
            initialMockRelease.projectId,
            initialMockRelease.tagName,
          ),
        ],
      ),
    );
  });

  it('staging release state failed > should update notification', async () => {
    // Given
    // Release has a startingDeployment for staging
    await updateRelease(
      initialMockRelease.projectId,
      initialMockRelease.tagName,
      () => ({
        startedDeployments: [
          { environment: 'integration', date: '2021-04-28 21:50:00 +0200' },
          { environment: 'staging', date: '2021-04-28 21:50:00 +0200' },
        ],
        failedDeployments: [
          { environment: 'integration', date: '2021-04-28 21:51:00 +0200' },
          { environment: 'staging', date: '2021-04-28 21:51:00 +0200' },
        ],
      }),
    );

    const releaseStateUpdates: ReleaseStateUpdate[] = [
      { environment: 'staging', deploymentState: 'failed' },
    ];
    mockProjectReleaseConfig(releaseStateUpdates);

    // When
    const response = await triggerGitlabDeploymentHook({
      ...deploymentHookFixture,
      status: 'failed',
      status_changed_at: '2021-04-28 21:52:30 +0200',
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith({
      channel: 'notification-channel-1',
      icon_url: slackUserFixture.profile.image_72,
      username: slackUserFixture.real_name,
      link_names: true,
      text: `:rocket-boom: ${deploymentHookFixture.project.name} STG`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:rocket-boom: ${deploymentHookFixture.project.name} STG - <${deploymentFixture.deployable.pipeline.web_url}|pipeline> - <${deploymentHookFixture.project.web_url}/-/releases/${deploymentFixture.ref}|release notes>`,
          },
        },
      ],
    });
    expect(slackBotWebClient.chat.update).toHaveBeenCalledTimes(1); // For the release channel
    expect(slackBotWebClient.chat.update).toHaveBeenCalledWith(
      getReleaseUpdateMessageFixture(
        'release-channel',
        deploymentFixture.ref,
        initialMockRelease.ts!,
        [
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `❌ *Integration:* Deployment failed — started <!date^1619639400^at {time}|earlier>, failed <!date^1619639460^at {time}|now>`,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `❌ *Staging:* Deployment failed — started <!date^1619639400^at {time}|earlier>, failed <!date^1619639550^at {time}|now>`,
              },
            ],
          },
          cancelReleaseButton(
            initialMockRelease.projectId,
            initialMockRelease.tagName,
          ),
        ],
      ),
    );
  });

  it('staging release state is monitoring  > should update notification', async () => {
    // Given
    // Release has a startingDeployment for staging
    await updateRelease(
      initialMockRelease.projectId,
      initialMockRelease.tagName,
      () => ({
        startedDeployments: [
          { environment: 'staging', date: '2021-04-28 21:50:00 +0200' },
        ],
      }),
    );

    const releaseStateUpdates: ReleaseStateUpdate[] = [
      { environment: 'staging', deploymentState: 'monitoring' },
    ];
    mockProjectReleaseConfig(releaseStateUpdates);

    // When
    const response = await triggerGitlabDeploymentHook({
      ...deploymentHookFixture,
      status: 'success',
      status_changed_at: '2021-04-28 21:52:30 +0200',
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith({
      channel: 'notification-channel-1',
      icon_url: slackUserFixture.profile.image_72,
      username: slackUserFixture.real_name,
      link_names: true,
      text: `:mag: ${deploymentHookFixture.project.name} STG`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:mag: ${deploymentHookFixture.project.name} STG - <${deploymentFixture.deployable.pipeline.web_url}|pipeline> - <${deploymentHookFixture.project.web_url}/-/releases/${deploymentFixture.ref}|release notes>`,
          },
        },
      ],
    });
    expect(slackBotWebClient.chat.update).toHaveBeenCalledTimes(1); // For the release channel
    expect(slackBotWebClient.chat.update).toHaveBeenCalledWith(
      getReleaseUpdateMessageFixture(
        'release-channel',
        deploymentFixture.ref,
        initialMockRelease.ts!,
        [
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `🔍 *Staging:* Monitoring — started <!date^1619639400^at {time}|earlier>, finished <!date^1619639550^at {time}|now> (*took ${2}m ${30}s*)`,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `:mag: @${initialMockRelease.slackAuthor.name}, please verify the changes on Staging are correct.`,
              },
            ],
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                style: 'danger',
                action_id: 'release-button-cancel-action',
                value: 'release~~1148~~stable-20200101-1000',
                text: {
                  type: 'plain_text',
                  text: 'Cancel Release',
                  emoji: true,
                },
                confirm: {
                  title: {
                    type: 'plain_text',
                    text: 'Are you sure?',
                  },
                  text: {
                    type: 'mrkdwn',
                    text: 'This will cancel the release. You will not be able to undo this action.',
                  },
                  confirm: {
                    type: 'plain_text',
                    text: 'Yes, Cancel',
                  },
                  deny: {
                    type: 'plain_text',
                    text: 'No',
                  },
                },
              },
            ],
          },
        ],
      ),
    );
  });

  it('staging release state is completed and production is starting  > should update notification', async () => {
    // Given
    await updateRelease(
      initialMockRelease.projectId,
      initialMockRelease.tagName,
      () => ({
        startedDeployments: [
          { environment: 'staging', date: '2021-04-28 21:50:00 +0200' },
        ],
        successfulDeployments: [
          { environment: 'staging', date: '2021-04-28 21:52:30 +0200' },
        ],
      }),
    );

    const releaseStateUpdates: ReleaseStateUpdate[] = [
      { environment: 'staging', deploymentState: 'completed' },
      { environment: 'production', deploymentState: 'deploying' },
    ];
    mockProjectReleaseConfig(releaseStateUpdates);

    // When
    const response = await triggerGitlabDeploymentHook({
      ...deploymentHookFixture,
      environment: 'production',
      status: 'running',
      status_changed_at: '2021-04-28 21:52:30 +0200',
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith({
      channel: 'notification-channel-1',
      icon_url: slackUserFixture.profile.image_72,
      username: slackUserFixture.real_name,
      link_names: true,
      text: `:ccheck: ${deploymentHookFixture.project.name} STG\n:rocket: ${deploymentHookFixture.project.name} PRD`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:ccheck: ${deploymentHookFixture.project.name} STG - <${deploymentFixture.deployable.pipeline.web_url}|pipeline> - <${deploymentHookFixture.project.web_url}/-/releases/${deploymentFixture.ref}|release notes>`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:rocket: ${deploymentHookFixture.project.name} PRD - <${deploymentFixture.deployable.pipeline.web_url}|pipeline> - <${deploymentHookFixture.project.web_url}/-/releases/${deploymentFixture.ref}|release notes>`,
          },
        },
      ],
    });
    expect(slackBotWebClient.chat.update).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.update).toHaveBeenCalledWith(
      getReleaseUpdateMessageFixture(
        'release-channel',
        deploymentFixture.ref,
        initialMockRelease.ts!,
        [
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `✅ *Staging:* Deployed successfully — started <!date^1619639400^at {time}|earlier>, finished <!date^1619639550^at {time}|now> (*took ${2}m ${30}s*)`,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `⏳ *Production:* Deployment started <!date^1619639550^at {time} on {date_short_pretty}|now>`,
              },
            ],
          },
          cancelReleaseButton(
            initialMockRelease.projectId,
            initialMockRelease.tagName,
          ),
        ],
      ),
    );
  });

  it('production release state is monitoring  > should update notification', async () => {
    // Given
    await updateRelease(
      initialMockRelease.projectId,
      initialMockRelease.tagName,
      () => ({
        startedDeployments: [
          { environment: 'production', date: '2021-04-28 21:52:00 +0200' },
        ],
      }),
    );

    const releaseStateUpdates: ReleaseStateUpdate[] = [
      { environment: 'production', deploymentState: 'monitoring' },
    ];
    mockProjectReleaseConfig(releaseStateUpdates);

    // When
    const response = await triggerGitlabDeploymentHook({
      ...deploymentHookFixture,
      environment: 'production',
      status: 'success',
      status_changed_at: '2021-04-28 21:55:30 +0200',
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith({
      channel: 'notification-channel-1',
      icon_url: slackUserFixture.profile.image_72,
      username: slackUserFixture.real_name,
      link_names: true,
      text: `:mag: ${deploymentHookFixture.project.name} PRD`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:mag: ${deploymentHookFixture.project.name} PRD - <${deploymentFixture.deployable.pipeline.web_url}|pipeline> - <${deploymentHookFixture.project.web_url}/-/releases/${deploymentFixture.ref}|release notes>`,
          },
        },
      ],
    });
    expect(slackBotWebClient.chat.update).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.update).toHaveBeenCalledWith(
      getReleaseUpdateMessageFixture(
        'release-channel',
        deploymentFixture.ref,
        initialMockRelease.ts!,
        [
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `🔍 *Production:* Monitoring — started <!date^1619639520^at {time}|earlier>, finished <!date^1619639730^at {time}|now> (*took 3m 30s*)`,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `:mag: @${initialMockRelease.slackAuthor.name}, please verify the changes on Production are correct.`,
              },
            ],
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                style: 'danger',
                action_id: 'release-button-cancel-action',
                value: 'release~~1148~~stable-20200101-1000',
                text: {
                  type: 'plain_text',
                  text: 'Cancel Release',
                  emoji: true,
                },
                confirm: {
                  title: {
                    type: 'plain_text',
                    text: 'Are you sure?',
                  },
                  text: {
                    type: 'mrkdwn',
                    text: 'This will cancel the release. You will not be able to undo this action.',
                  },
                  confirm: {
                    type: 'plain_text',
                    text: 'Yes, Cancel',
                  },
                  deny: {
                    type: 'plain_text',
                    text: 'No',
                  },
                },
              },
              {
                type: 'button',
                style: 'primary',
                action_id: 'release-button-end-action',
                value: 'release~~1148~~stable-20200101-1000',
                text: {
                  type: 'plain_text',
                  text: 'Validate & End Release',
                  emoji: true,
                },
              },
            ],
          },
        ],
      ),
    );
  });

  it('support release state is monitoring  > should update notification', async () => {
    // Given
    await updateRelease(
      initialMockRelease.projectId,
      initialMockRelease.tagName,
      () => ({
        startedDeployments: [
          { environment: 'support', date: '2021-04-28 21:52:00 +0200' },
        ],
      }),
    );

    const releaseStateUpdates: ReleaseStateUpdate[] = [
      { environment: 'support', deploymentState: 'monitoring' },
    ];
    mockProjectReleaseConfig(releaseStateUpdates);

    // When
    const response = await triggerGitlabDeploymentHook({
      ...deploymentHookFixture,
      environment: 'support',
      status: 'success',
      status_changed_at: '2021-04-28 21:55:30 +0200',
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith({
      channel: 'notification-channel-1',
      icon_url: slackUserFixture.profile.image_72,
      username: slackUserFixture.real_name,
      link_names: true,
      text: `:mag: ${deploymentHookFixture.project.name} SUP`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:mag: ${deploymentHookFixture.project.name} SUP - <${deploymentFixture.deployable.pipeline.web_url}|pipeline> - <${deploymentHookFixture.project.web_url}/-/releases/${deploymentFixture.ref}|release notes>`,
          },
        },
      ],
    });
    expect(slackBotWebClient.chat.update).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.update).toHaveBeenCalledWith(
      getReleaseUpdateMessageFixture(
        'release-channel',
        deploymentFixture.ref,
        initialMockRelease.ts!,
        [
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `🔍 *Support:* Monitoring — started <!date^1619639520^at {time}|earlier>, finished <!date^1619639730^at {time}|now> (*took 3m 30s*)`,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `:mag: @${initialMockRelease.slackAuthor.name}, please verify the changes on Support are correct.`,
              },
            ],
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                style: 'danger',
                action_id: 'release-button-cancel-action',
                value: 'release~~1148~~stable-20200101-1000',
                text: {
                  type: 'plain_text',
                  text: 'Cancel Release',
                  emoji: true,
                },
                confirm: {
                  title: {
                    type: 'plain_text',
                    text: 'Are you sure?',
                  },
                  text: {
                    type: 'mrkdwn',
                    text: 'This will cancel the release. You will not be able to undo this action.',
                  },
                  confirm: {
                    type: 'plain_text',
                    text: 'Yes, Cancel',
                  },
                  deny: {
                    type: 'plain_text',
                    text: 'No',
                  },
                },
              },
              {
                type: 'button',
                style: 'primary',
                action_id: 'release-button-end-action',
                value: 'release~~1148~~stable-20200101-1000',
                text: {
                  type: 'plain_text',
                  text: 'Validate & End Release',
                  emoji: true,
                },
              },
            ],
          },
        ],
      ),
    );
  });

  it('support release state is completed > should update notification', async () => {
    // Given
    await updateRelease(
      initialMockRelease.projectId,
      initialMockRelease.tagName,
      () => ({
        description: `\
- [feat(great): implement great feature](http://gitlab.example.com/my-group/my-project/-/merge_requests/1) - [SPAR-156](https://my-ticket-management.com/view/SPAR-156)
- [feat(great): implement another great feature](http://gitlab.example.com/my-group/my-project/-/merge_requests/1) - [SPAR-158](https://my-ticket-management.com/view/SPAR-158)
- [feat(great-3): implement great 3 feature](http://gitlab.example.com/my-group/my-project/-/merge_requests/1) - [SPAR-159](https://my-ticket-management.com/view/SPAR-159)
- [feat(great-4): implement great 4 feature](http://gitlab.example.com/my-group/my-project/-/merge_requests/1) - [SPAR-160](https://my-ticket-management.com/view/SPAR-160)`,
        startedDeployments: [
          { environment: 'staging', date: '2021-04-28 21:45:00 +0200' },
          { environment: 'support', date: '2021-04-28 21:52:00 +0200' },
        ],
        successfulDeployments: [
          { environment: 'staging', date: '2021-04-28 21:50:00 +0200' },
        ],
      }),
    );

    const releaseStateUpdates: ReleaseStateUpdate[] = [
      { environment: 'support', deploymentState: 'completed' },
    ];
    mockProjectReleaseConfig(releaseStateUpdates);

    // When
    const response = await triggerGitlabDeploymentHook({
      ...deploymentHookFixture,
      environment: 'support',
      status: 'success',
      status_changed_at: '2021-04-28 21:55:30 +0200',
    });

    // Then
    const expectedReleaseMessage = getReleaseCompletedMessageFixture(
      'release-channel',
      deploymentFixture.ref,
      initialMockRelease.ts!,
      [
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `✅ *Staging:* Deployed successfully — started <!date^1619639100^at {time}|earlier>, finished <!date^1619639400^at {time}|now> (*took 5m 0s*)`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `✅ *Support:* Deployed successfully — started <!date^1619639520^at {time}|earlier>, finished <!date^1619639730^at {time}|now> (*took 3m 30s*)`,
            },
          ],
        },
        cancelReleaseButton(
          initialMockRelease.projectId,
          initialMockRelease.tagName,
        ),
      ],
    );
    (expectedReleaseMessage.blocks[2] as SectionBlock).text!.text =
      `\​*Changes (4 total):*​

> •   <http://gitlab.example.com/my-group/my-project/-/merge_requests/1|feat(great): implement great feature> - <https://my-ticket-management.com/view/SPAR-156|SPAR-156>
> •   <http://gitlab.example.com/my-group/my-project/-/merge_requests/1|feat(great): implement another great feature> - <https://my-ticket-management.com/view/SPAR-158|SPAR-158>
> •   <http://gitlab.example.com/my-group/my-project/-/merge_requests/1|feat(great-3): implement great 3 feature> - <https://my-ticket-management.com/view/SPAR-159|SPAR-159>

​_... and 1 more._​
`;

    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith({
      channel: 'notification-channel-1',
      icon_url: slackUserFixture.profile.image_72,
      username: slackUserFixture.real_name,
      link_names: true,
      text: `:ccheck: ${deploymentHookFixture.project.name} SUP`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:ccheck: ${deploymentHookFixture.project.name} SUP - <${deploymentFixture.deployable.pipeline.web_url}|pipeline> - <${deploymentHookFixture.project.web_url}/-/releases/${deploymentFixture.ref}|release notes>`,
          },
        },
      ],
    });
    expect(slackBotWebClient.chat.update).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.update).toHaveBeenCalledWith(
      expectedReleaseMessage,
    );
  });
});

async function triggerGitlabDeploymentHook(hook: GitlabDeploymentHook) {
  return await request(app)
    .post('/api/v1/homer/gitlab')
    .set(getGitlabHeaders())
    .send(hook);
}
