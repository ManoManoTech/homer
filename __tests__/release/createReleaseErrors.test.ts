import type { ModalView } from '@slack/web-api';
import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { slackBotWebClient } from '@/core/services/slack';
import type { BlockActionView } from '@/core/typings/BlockActionPayload';
import { buildReleaseModalView } from '@/release/commands/create/viewBuilders/buildReleaseModalView';
import type { ProjectReleaseConfig } from '@/release/typings/ProjectReleaseConfig';
import ConfigHelper from '@/release/utils/ConfigHelper';
import { slackUserFixture } from '@root/__tests__/__fixtures__/slackUserFixture';
import { projectFixture } from '../__fixtures__/projectFixture';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { waitFor } from '../utils/waitFor';

const RELEASE_TAG_NAME = 'stable-19700101-0100';

describe('release > errors shown to the user', () => {
  let releaseConfig: ProjectReleaseConfig;

  beforeAll(async () => {
    releaseConfig = await ConfigHelper.getProjectReleaseConfig(
      projectFixture.id,
    );
  });

  it('replaces the loader with the error when the modal cannot be built', async () => {
    // Given: the project cannot be fetched
    const body = {
      channel_id: releaseConfig.releaseChannelId,
      text: 'release',
      trigger_id: 'triggerId',
    };
    (slackBotWebClient.views.open as jest.Mock).mockResolvedValue({
      view: { id: 'viewId' },
    });

    // When
    const response = await request(app)
      .post('/api/v1/homer/command')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    await waitFor(() =>
      expect(slackBotWebClient.views.update).toHaveBeenCalledWith({
        view_id: 'viewId',
        view: expect.objectContaining({
          blocks: [
            expect.objectContaining({
              block_id: 'release-error-block',
              text: {
                type: 'plain_text',
                text: expect.stringContaining(
                  'Homer could not load the release data: Unmocked fetch call',
                ),
              },
            }),
          ],
        }),
      }),
    );
    const { view } = (slackBotWebClient.views.update as jest.Mock).mock
      .calls[0][0];
    expect(view.submit).toBeUndefined();
  });

  it('keeps the project select so the user can pick another project', async () => {
    // Given
    const projectBlock = {
      type: 'input',
      block_id: 'release-project-block',
      element: {
        type: 'static_select',
        action_id: 'release-select-project-action',
        options: [
          {
            text: { type: 'plain_text', text: 'project' },
            value: `${projectFixture.id}`,
          },
        ],
      },
      label: { type: 'plain_text', text: 'Project' },
    };
    const view = {
      blocks: [projectBlock],
      state: { values: {} },
    } as unknown as BlockActionView;

    // When: fetching the tags of the project fails
    const modal = (await buildReleaseModalView({ view })) as ModalView;

    // Then
    expect(modal.blocks).toEqual([
      projectBlock,
      expect.objectContaining({ block_id: 'release-error-block' }),
    ]);
    expect(modal.submit).toEqual({ type: 'plain_text', text: 'Retry' });
  });

  it('tells the user when the release cannot be started', async () => {
    // Given: the changelog cannot be generated
    (slackBotWebClient.users.info as jest.Mock).mockResolvedValue({
      user: slackUserFixture,
    });
    const body = {
      payload: JSON.stringify({
        type: 'view_submission',
        user: { id: slackUserFixture.id },
        view: {
          callback_id: 'release-create-modal',
          id: 'viewId',
          state: {
            values: {
              'release-project-block': {
                'release-select-project-action': {
                  selected_option: { value: `${projectFixture.id}` },
                },
              },
              'release-tag-block': {
                'release-tag-action': { value: RELEASE_TAG_NAME },
              },
            },
          },
        },
      }),
    };

    // When
    const response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    await waitFor(() =>
      expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: slackUserFixture.id,
        text: expect.stringContaining(
          `Homer could not start the release \`${RELEASE_TAG_NAME}\` :homer-stressed: Unmocked fetch call`,
        ),
      }),
    );
  });
});
