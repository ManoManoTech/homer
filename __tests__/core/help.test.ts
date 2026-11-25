import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_OK } from '@/constants';
import { mockUrl } from '@root/__mocks__/fetch-mock';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { waitFor } from '../utils/waitFor';

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

  it('should delete the help when the user clicks its OK button', async () => {
    // Given
    const command = { channel_id: 'channelId', user_id: 'userId' };
    const help = (
      await request(app)
        .post('/api/v1/homer/command')
        .set(getSlackHeaders(command))
        .send(command)
    ).body;
    const [okButton] = help.blocks.at(-1).elements;
    const responseUrl = 'https://slack/responseUrl';
    const responseUrlCall = mockUrl(responseUrl, {});
    const body = {
      payload: JSON.stringify({
        actions: [{ action_id: okButton.action_id }],
        container: { channel_id: 'channelId' },
        response_url: responseUrl,
        type: 'block_actions',
        user: { id: 'userId' },
      }),
    };

    // When
    const response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(okButton.text.text).toEqual('OK');
    await waitFor(() => {
      expect(
        JSON.parse(responseUrlCall.calledWith?.[1]?.body as string),
      ).toEqual({ delete_original: true });
    });
  });
});
