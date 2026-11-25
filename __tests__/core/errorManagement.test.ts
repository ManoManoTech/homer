import type { Request, Response } from 'express';
import request from 'supertest';
import { app } from '@/app';
import {
  EXPIRED_TRIGGER_ID_ERROR_MESSAGE,
  EXPIRED_TRIGGER_ID_SLACK_ERROR,
  GENERIC_ERROR_MESSAGE,
  HTTP_STATUS_NO_CONTENT,
  HTTP_STATUS_OK,
  PRIVATE_CHANNEL_ERROR_MESSAGE,
} from '@/constants';
import { errorMiddleware } from '@/core/middlewares/errorMiddleware';
import { addProjectToChannel } from '@/core/services/data';
import { logger } from '@/core/services/logger';
import { addOkButton, slackBotWebClient } from '@/core/services/slack';
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
      expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(
        2,
        addOkButton({
          channel: channelId,
          user: userId,
          text: GENERIC_ERROR_MESSAGE,
        }),
      );
    });

    describe('expired_trigger_id', () => {
      function makeReqRes(): { req: Request; res: Response; next: jest.Mock } {
        const req = {
          header: jest.fn().mockReturnValue(undefined),
          body: {
            command: '/homer',
            user_id: 'U1',
            channel_id: 'C1',
          },
        } as unknown as Request;
        const res = {
          headersSent: false,
          send: jest.fn(),
        } as unknown as Response;
        const next = jest.fn();
        return { req, res, next };
      }

      it('logs a structured warn with command + user context (not error)', async () => {
        // Given
        const error = Object.assign(
          new Error(`An API error occurred: ${EXPIRED_TRIGGER_ID_SLACK_ERROR}`),
          { data: { ok: false, error: EXPIRED_TRIGGER_ID_SLACK_ERROR } },
        );
        const { req, res, next } = makeReqRes();

        // When
        await errorMiddleware(error, req, res, next);

        // Then
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            err: error,
            slackError: EXPIRED_TRIGGER_ID_SLACK_ERROR,
            command: '/homer',
            userId: 'U1',
            channelId: 'C1',
          }),
          'slack trigger_id expired before views.open',
        );
        expect(logger.error).not.toHaveBeenCalled();
      });

      it('still replies with the friendly retry message when headers are not yet sent', async () => {
        // Given
        const error = new Error(
          `An API error occurred: ${EXPIRED_TRIGGER_ID_SLACK_ERROR}`,
        );
        const { req, res, next } = makeReqRes();

        // When
        await errorMiddleware(error, req, res, next);

        // Then
        expect(res.send).toHaveBeenCalledWith(EXPIRED_TRIGGER_ID_ERROR_MESSAGE);
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
