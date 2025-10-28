import type { KnownBlock } from '@slack/types';
import type { HeaderBlock } from '@slack/types/dist/block-kit/blocks';
import { pipelineFixture } from '@root/__tests__/__fixtures__/pipelineFixture';
import { slackUserFixture } from '@root/__tests__/__fixtures__/slackUserFixture';
import { projectFixture } from './projectFixture';

export function getReleaseMessageFixture(
  releaseChannelId: string,
  releaseTagName: string,
) {
  return {
    channel: releaseChannelId,
    blocks: [
      {
        text: {
          emoji: true,
          text: '🚀 Release In Progress: diaspora-project-site',
          type: 'plain_text',
        },
        type: 'header',
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Version:*\n\`<${projectFixture.web_url}/-/releases/${releaseTagName}|${releaseTagName}>\``,
          },
          {
            type: 'mrkdwn',
            text: `*Initiated by:*\n@${slackUserFixture.name}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          text: `\​*Changes (2 total):*​

> •   <http://gitlab.example.com/my-group/my-project/-/merge_requests/1|feat(great): implement great feature> - <https://my-ticket-management.com/view/SPAR-156|SPAR-156>
> •   <http://gitlab.example.com/my-group/my-project/-/merge_requests/1|feat(great): implement another great feature> - <https://my-ticket-management.com/view/SPAR-158|SPAR-158>
`,
          type: 'mrkdwn',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            url: pipelineFixture.web_url,
            action_id: 'not-interactive',
            text: {
              type: 'plain_text',
              text: 'View Pipeline',
              emoji: true,
            },
          },
          {
            type: 'button',
            action_id: 'release-button-full-changelog-action',
            text: {
              type: 'plain_text',
              text: 'View Full Changelog',
              emoji: true,
            },
            value: `release~~1148~~${releaseTagName}`,
          },
        ],
      },
    ] as KnownBlock[],
    icon_url: slackUserFixture.profile.image_72,
    username: slackUserFixture.real_name,
    link_names: true,
  };
}

export function getReleaseUpdateMessageFixture(
  releaseChannelId: string,
  releaseTagName: string,
  ts: string,
  additionalBlocks: KnownBlock[],
) {
  const releaseMessage = getReleaseMessageFixture(
    releaseChannelId,
    releaseTagName,
  );
  releaseMessage.blocks.push({ type: 'divider' });
  releaseMessage.blocks.push(...additionalBlocks);

  return {
    ...releaseMessage,
    ts: ts,
  };
}

export function getReleaseCompletedMessageFixture(
  releaseChannelId: string,
  releaseTagName: string,
  ts: string,
  additionalBlocks: KnownBlock[],
) {
  const releaseMessage = getReleaseMessageFixture(
    releaseChannelId,
    releaseTagName,
  );
  releaseMessage.blocks.push({ type: 'divider' });
  releaseMessage.blocks.push(...additionalBlocks);

  (releaseMessage.blocks[0] as HeaderBlock).text.text =
    '✅ Release Completed: diaspora-project-site';

  return {
    ...releaseMessage,
    ts: ts,
  };
}
