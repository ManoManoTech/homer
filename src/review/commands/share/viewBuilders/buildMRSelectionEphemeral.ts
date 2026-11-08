import type { ChatPostEphemeralArguments } from '@slack/web-api';
import type { UnifiedPullRequest } from '@/core/typings/UnifiedModels';
import { formatProjectRef } from '@/core/utils/projectRef';
import { injectActionsParameters } from '@/core/utils/slackActions';

const MAX_OPTION_TEXT_LENGTH = 31;

interface MRSelectionEphemeralData {
  channelId: string;
  mergeRequests: UnifiedPullRequest[];
  query: string;
  userId: string;
}

export function buildMRSelectionEphemeral({
  channelId,
  mergeRequests,
  query,
  userId,
}: MRSelectionEphemeralData): ChatPostEphemeralArguments {
  return {
    channel: channelId,
    user: userId,
    text: `Multiple merge requests match \`${query}\`. Choose one`,
    blocks: [
      {
        type: 'section',
        block_id: 'review-select-merge-request-block',
        text: {
          type: 'mrkdwn',
          text: `Multiple merge requests match \`${query}\`. Choose one:`,
        },
        accessory: {
          type: 'static_select',
          action_id: 'review-select-merge-request',
          placeholder: {
            type: 'plain_text',
            text: 'Choose a merge request',
            emoji: true,
          },
          options: mergeRequests.map((mergeRequest) => ({
            text: {
              type: 'plain_text',
              text:
                mergeRequest.title.length > MAX_OPTION_TEXT_LENGTH
                  ? `${mergeRequest.title.slice(0, MAX_OPTION_TEXT_LENGTH)}...`
                  : mergeRequest.title,
              emoji: true,
            },
            value: injectActionsParameters(
              'merge-request',
              formatProjectRef(mergeRequest),
              mergeRequest.iid,
            ),
          })),
        },
      },
    ],
  };
}
