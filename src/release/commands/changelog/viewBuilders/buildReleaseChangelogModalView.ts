import type { View } from '@slack/types';
import type { DataRelease } from '@/core/typings/Data';
import { slackifyChangelog } from '@/release/commands/create/utils/slackifyChangelog';

export async function buildReleaseChangelogModalView(
  release: DataRelease,
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
          text: `Release ${release.tagName}`,
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
          text: release.description
            ? slackifyChangelog(release.description)
            : 'No change has been found.',
        },
      },
    ],
  };
}
