import request from 'supertest';
import { app } from '@/app';
import {
  GENERIC_ERROR_MESSAGE,
  HTTP_STATUS_NO_CONTENT,
  HTTP_STATUS_OK,
  PRIVATE_CHANNEL_ERROR_MESSAGE,
} from '@/constants';
import { addProjectToChannel } from '@/core/services/data';
import { logger } from '@/core/services/logger';
import { slackBotWebClient } from '@/core/services/slack';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockGitlabCall } from '../utils/mockGitlabCall';

describe('core > errorManagement', () => {
  describe('errorMiddleware', () => {
    it('should log internal errors', async () => {
      // Given
      const body = { text: 0 };

      // When
      await request(app)
        .post('/api/v1/homer/command')
        .set(getSlackHeaders(body))
        .send(body);

      // Then
      expect(logger.error).toHaveBeenCalled();
    });

    it('should send generic error message in case of internal error (headers not sent)', async () => {
      // Given
      const body = { text: 0 };

      // When
      const response = await request(app)
        .post('/api/v1/homer/command')
        .set(getSlackHeaders(body))
        .send(body);

      // Then
      expect(response.status).toEqual(HTTP_STATUS_OK);
      expect(response.text).toEqual(GENERIC_ERROR_MESSAGE);
    });

    it('should send generic error message in case of internal error (headers sent)', async () => {
      // Given
      const channelId = 'channelId';
      const projectId = 123;
      const search = 'search';
      const userId = 'userId';
      const body = {
        channel_id: channelId,
        text: `review ${search}`,
        user_id: userId,
      };
      await addProjectToChannel({ channelId, projectId });
      mockGitlabCall(
        `/projects/${projectId}/merge_requests?state=opened&search=${search}`,
        [],
      );
      (slackBotWebClient.chat.postEphemeral as jest.Mock).mockRejectedValueOnce(
        new Error(),
      );

      // When
      const response = await request(app)
        .post('/api/v1/homer/command')
        .set(getSlackHeaders(body))
        .send(body);

      // Then
      expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
      expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(2, {
        channel: channelId,
        user: userId,
        text: GENERIC_ERROR_MESSAGE,
      });
    });

    it('should send private channel error message in case of channel not found error (headers sent)', async () => {
      // Given
      const channelId = 'channelId';
      const projectId = 123;
      const search = 'search';
      const userChannelId = 'userChannelId';
      const userId = 'userId';
      const body = {
        channel_id: channelId,
        text: `review ${search}`,
        user_id: userId,
      };
      await addProjectToChannel({ channelId, projectId });
      mockGitlabCall(
        `/projects/${projectId}/merge_requests?state=opened&search=${search}`,
        [],
      );
      (slackBotWebClient.chat.postEphemeral as jest.Mock).mockRejectedValueOnce(
        new Error('channel_not_found'),
      );
      (slackBotWebClient.conversations.open as jest.Mock).mockResolvedValue({
        channel: { id: userChannelId },
      });

      // When
      const response = await request(app)
        .post('/api/v1/homer/command')
        .set(getSlackHeaders(body))
        .send(body);

      // Then
      expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
      expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(1, {
        channel: userChannelId,
        text: PRIVATE_CHANNEL_ERROR_MESSAGE,
      });
    });
  });
});
