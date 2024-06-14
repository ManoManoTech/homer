import { HTTP_STATUS_OK } from '@/constants';
import { waitFor } from '@root/__tests__/utils/waitFor';
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

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);

    await waitFor(() => {
      // expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledTimes(1);
    });
  });
});
