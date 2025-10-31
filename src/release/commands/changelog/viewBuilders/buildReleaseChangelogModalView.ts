import type { View } from '@slack/types';
import { slackifyChangelog } from '@/release/commands/create/utils/slackifyChangelog';

export async function buildReleaseChangelogModalView(
  tagName: string,
  description: string,
): Promise<View> {
  return {
    type: 'modal',
    callback_id: 'release-changelog-modal',
    title: {
      type: 'plain_text',
      text: `Release Changelog`,
    },
    submit: {
      type: 'plain_text',
      text: 'Ok',
    },
    notify_on_close: false,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `Release ${tagName}`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*✨ Changes*',
        },
      },
      {
        type: 'section',
        block_id: 'changelog-preview-block',
        text: {
          type: 'mrkdwn',
          text: description
            ? slackifyChangelog(description)
            : 'No change has been found.',
        },
      },
    ],
  };
}
