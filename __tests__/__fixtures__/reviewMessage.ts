import { mergeRequestApprovalsFixture } from './mergeRequestApprovalsFixture';
import { mergeRequestDetailsFixture } from './mergeRequestDetailsFixture';
import { mergeRequestFixture } from './mergeRequestFixture';
import { mergeRequestReviewersFixture } from './mergeRequestReviewersFixture';
import { projectFixture } from './projectFixture';

export const reviewMessagePostFixture = {
  blocks: [
    {
      accessory: {
        action_id: 'review-message-actions',
        options: [
          {
            text: {
              type: 'plain_text',
              text: 'Create a pipeline',
            },
            value: 'review-create-pipeline~~1148~~test1',
          },
          {
            text: {
              type: 'plain_text',
              text: 'Rebase source branch',
            },
            value: 'review-rebase-source-branch~~1148~~1',
          },
          {
            text: {
              text: 'Delete message',
              type: 'plain_text',
            },
            value: 'review-delete-message',
          },
        ],
        type: 'overflow',
      },
      text: {
        text: `*<${mergeRequestDetailsFixture.web_url}|${mergeRequestDetailsFixture.title}>*`,
        type: 'mrkdwn',
      },
      type: 'section',
    },
    {
      elements: [
        {
          text: `Project: _<${projectFixture.web_url}|${projectFixture.path_with_namespace}>_`,
          type: 'mrkdwn',
        },
        {
          text: `Target branch: \`${mergeRequestDetailsFixture.target_branch}\``,
          type: 'mrkdwn',
        },
        {
          text: `Open discussion(s): \`${mergeRequestDetailsFixture.user_notes_count}\``,
          type: 'mrkdwn',
        },
        {
          text: `Changes: \`${mergeRequestDetailsFixture.changes_count}\``,
          type: 'mrkdwn',
        },
        {
          text: `Pipeline: ✅ success`,
          type: 'mrkdwn',
        },
        {
          text: `Mergeable: ✅ Yes`,
          type: 'mrkdwn',
        },
      ],
      type: 'context',
    },
    {
      fields: [
        {
          text: `*Participants*\n @${mergeRequestDetailsFixture.assignees[0].username} @${mergeRequestReviewersFixture[0].user.username}`,
          type: 'mrkdwn',
        },
        {
          text: `*Approvals*\n 1/${mergeRequestApprovalsFixture.approvals_required} required ⏳`,
          type: 'mrkdwn',
        },
        {
          text: `*Approved by*\n @${mergeRequestApprovalsFixture.approved_by[0].user.username}`,
          type: 'mrkdwn',
        },
      ],
      type: 'section',
    },
  ],
  channel: 'channelId',
  icon_url: 'image_72',
  link_names: true,
  text: `${mergeRequestDetailsFixture.title} ${mergeRequestDetailsFixture.web_url}`,
  username: `${mergeRequestFixture.author.username}.real`,
};

export const reviewMessageUpdateFixture = {
  ...reviewMessagePostFixture,
  ts: 'ts',
};
