import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_OK } from '@/constants';
import { getSlackHeaders } from '../utils/getSlackHeaders';

describe('core > help', () => {
  it('should display help', async () => {
    // Given
    const channelId = 'channelId';
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      user_id: userId,
    };

    // When
    const response = await request(app)
      .post('/api/v1/homer/command')
      .set(getSlackHeaders(body))
      .send(body);
    const json = (await response.body) as any;

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(json.channel).toEqual(channelId);
    expect(json.blocks?.[0]?.text?.text).toContain('available commands');
  });
});
