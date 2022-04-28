import { HTTP_STATUS_OK } from '@/constants';
import { addReviewToChannel } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import { mergeRequestFixture } from '../__fixtures__/mergeRequestFixture';
import { pipelineFixture } from '../__fixtures__/pipelineFixture';
import { fetch } from '../utils/fetch';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockGitlabCall } from '../utils/mockGitlabCall';

describe('review > createPipeline', () => {
  it('should allow user to create a pipeline', async () => {
    // Given
    const channelId = 'channelId';
    const mergeRequestIid = 1;
    const projectId = mergeRequestFixture.project_id;
    const ts = 'ts';
    const userId = 'userId';
    const body = {
      payload: JSON.stringify({
        actions: [
          {
            action_id: 'review-message-actions',
            selected_option: {
              value: `review-create-pipeline~~${projectId}~~${mergeRequestFixture.source_branch}`,
            },
          },
        ],
        channel: { id: channelId },
        message: { ts },
        type: 'block_actions',
        user: { id: userId },
      }),
    };

    await addReviewToChannel({ channelId, mergeRequestIid, projectId, ts });

    const pipelineCallMock = mockGitlabCall(
      `/projects/${mergeRequestFixture.project_id}/pipeline`,
      pipelineFixture
    );

    // When
    const response = await fetch('/api/v1/homer/interactive', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(pipelineCallMock.calledWith?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({ ref: 'test1', variables: [] }),
      })
    );
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(1, {
      channel: channelId,
      text: expect.stringContaining('Pipeline created'),
      user: userId,
    });
  });

  it('should allow user to create a pipeline and to deploy', async () => {
    // Given
    const channelId = 'channelId';
    const mergeRequestIid = 1;
    const projectId = mergeRequestFixture.project_id;
    const ts = 'ts';
    const userId = 'userId';
    const body = {
      payload: JSON.stringify({
        actions: [
          {
            action_id: 'review-message-actions',
            selected_option: {
              value: `review-create-pipeline~~${projectId}~~${mergeRequestFixture.source_branch}~~fr-b2c`,
            },
          },
        ],
        channel: { id: channelId },
        message: { ts },
        type: 'block_actions',
        user: { id: userId },
      }),
    };

    await addReviewToChannel({ channelId, mergeRequestIid, projectId, ts });

    const pipelineCallMock = mockGitlabCall(
      `/projects/${mergeRequestFixture.project_id}/pipeline`,
      pipelineFixture
    );

    // When
    const response = await fetch('/api/v1/homer/interactive', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(pipelineCallMock.calledWith?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          ref: 'test1',
          variables: [
            { key: 'AUTO_DEPLOY', value: 'fr-b2c', variable_type: 'env_var' },
          ],
        }),
      })
    );
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(1, {
      channel: channelId,
      text: expect.stringContaining('Pipeline created'),
      user: userId,
    });
  });
});
