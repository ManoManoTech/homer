import { HTTP_STATUS_OK } from '@/constants';
import { fetch } from '../utils/fetch';
import { getSlackHeaders } from '../utils/getSlackHeaders';

describe('help', () => {
  it('help message should be displayed', async () => {
    // Given
    const channelId = 'channelId';
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      text: 'help',
      user_id: userId,
    };

    // When
    const response = await fetch('/api/v1/homer/command', {
      body,
      headers: getSlackHeaders(body),
    });
    const slackMessage = await response.json();

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackMessage.text).toContain('Here are the available commands:');
    expect(slackMessage.text).toContain(
      "Don't hesitate to join me on #support-homer to take a beer!"
    );
  });
});
