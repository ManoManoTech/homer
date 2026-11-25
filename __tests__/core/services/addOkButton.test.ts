import { addOkButton, SECTION_TEXT_MAX_LENGTH } from '@/core/services/slack';

describe('core > services > addOkButton', () => {
  it('should move a text into a section followed by an OK button', () => {
    expect(addOkButton({ channel: 'channelId', text: 'Done' })).toEqual({
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: 'Done' } },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              action_id: 'ephemeral-ok',
              text: { type: 'plain_text', text: 'OK' },
            },
          ],
        },
      ],
      channel: 'channelId',
      text: 'Done',
    });
  });

  it('should leave a text too long for a section as it is', () => {
    const message = {
      channel: 'channelId',
      text: 'a'.repeat(SECTION_TEXT_MAX_LENGTH + 1),
    };

    expect(addOkButton(message)).toEqual(message);
  });
});
