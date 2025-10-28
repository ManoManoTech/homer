import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_OK } from '@/constants';
import { createRelease, updateRelease } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import type { DataRelease } from '@/core/typings/Data';
import { slackifyChangelog } from '@/release/commands/create/utils/slackifyChangelog';
import ConfigHelper from '@/release/utils/ConfigHelper';
import { projectFixture } from '@root/__tests__/__fixtures__/projectFixture';
import { releaseFixture } from '@root/__tests__/__fixtures__/releaseFixture';
import { slackUserFixture } from '@root/__tests__/__fixtures__/slackUserFixture';
import { getSlackHeaders } from '@root/__tests__/utils/getSlackHeaders';

const initialMockRelease: DataRelease = {
  description:
    '- [feat(great): implement great feature](http://gitlab.example.com/my-group/my-project/-/merge_requests/1) - [SPAR-156](https://my-ticket-management.com/view/SPAR-156)\n- [feat(great): implement another great feature](http://gitlab.example.com/my-group/my-project/-/merge_requests/1) - [SPAR-158](https://my-ticket-management.com/view/SPAR-158)',
  failedDeployments: [],
  projectId: projectFixture.id,
  slackAuthor: slackUserFixture,
  startedDeployments: [],
  state: 'created',
  successfulDeployments: [],
  tagName: releaseFixture.tag_name,
};

describe('release > display full changelog', () => {
  it('should open a modal when the display changelog button is clicked', async () => {
    // Given
    const releaseConfig = await ConfigHelper.getProjectReleaseConfig(
      initialMockRelease.projectId,
    );
    const createdRelease = await createRelease(initialMockRelease);
    await updateRelease(
      createdRelease.projectId,
      createdRelease.tagName,
      () => ({
        ts: 'timestamp',
      }),
    );

    // When
    const body = {
      payload: JSON.stringify({
        type: 'block_actions',
        trigger_id: 'trigger_id',
        container: { channel_id: releaseConfig.releaseChannelId },
        user: { id: slackUserFixture.id },
        actions: [
          {
            action_id: 'release-button-full-changelog-action',
            block_id: '1Cj9B',
            text: {
              type: 'plain_text',
              text: 'View Full Changelog',
              emoji: true,
            },
            value: `release~~${createdRelease.projectId}~~${createdRelease.tagName}`,
            style: 'primary',
            type: 'button',
            action_ts: '1761587005.541595',
          },
        ],
      }),
    };

    const response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);

    expect(response.status).toEqual(HTTP_STATUS_OK);

    expect(slackBotWebClient.views.open).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.views.open).toHaveBeenCalledWith({
      trigger_id: 'trigger_id',
      view: {
        type: 'modal',
        callback_id: 'release-changelog-modal',
        title: {
          type: 'plain_text',
          text: `Release Changelog`,
        },
        submit: {
          type: 'plain_text',
          text: 'Ok',
        },
        notify_on_close: false,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `Release ${initialMockRelease.tagName}`,
            },
          },
          {
            type: 'divider',
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*✨ Changes*',
            },
          },
          {
            type: 'section',
            block_id: 'changelog-preview-block',
            text: {
              type: 'mrkdwn',
              text: slackifyChangelog(initialMockRelease.description),
            },
          },
        ],
      },
    });
  });
});
