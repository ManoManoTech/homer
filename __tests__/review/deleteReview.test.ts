import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_OK } from '@/constants';
import { addReviewToChannel } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import { getSlackHeaders } from '../utils/getSlackHeaders';

describe('review > deleteReview', () => {
  it('should allow user to delete a review message', async () => {
    // Given
    const channelId = 'channelId';
    const mergeRequestIid = 1;
    const projectId = 1;
    const ts = 'ts';
    const body = {
      payload: JSON.stringify({
        actions: [
          {
            action_id: 'review-message-actions',
            selected_option: { value: 'review-delete-message' },
          },
        ],
        channel: { id: channelId },
        message: { ts },
        type: 'block_actions',
      }),
    };

    await addReviewToChannel({ channelId, mergeRequestIid, projectId, ts });
    (slackBotWebClient.chat.delete as jest.Mock).mockResolvedValueOnce(
      undefined,
    );

    // When
    const response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.delete).toHaveBeenNthCalledWith(1, {
      channel: channelId,
      ts,
    });
    expect(
      await hasModelEntry('Review', { channelId, mergeRequestIid, ts }),
    ).toEqual(false);
  });
});
