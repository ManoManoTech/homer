import type { View } from '@slack/web-api';

export async function buildReleaseModalLoadingView(): Promise<View> {
  return {
    type: 'modal',
    callback_id: 'release-create-modal',
    title: {
      type: 'plain_text',
      text: 'Release',
    },
    submit: {
      type: 'plain_text',
      text: 'Start',
    },
    notify_on_close: false,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'plain_text',
          text: ':loader: Loading project data, please wait…',
        },
      },
    ],
  };
}
