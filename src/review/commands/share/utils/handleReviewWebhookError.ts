import type { Transaction } from 'sequelize';
import { IS_ARCHIVED_SLACK_ERROR } from '@/constants';
import { removeReview } from '@/core/services/data';
import { logger } from '@/core/services/logger';
import { isSlackErrorCode } from '@/core/services/slack';

interface ReviewWebhookErrorContext {
  hook: 'merge_request' | 'note' | 'push';
  mrIid: number;
  projectId: number;
  channelId: string;
  reviewTs?: string;
}

/**
 * Policy applied when a Slack call fails inside one of the review-flow webhook
 * handlers (note / merge_request / push).
 *
 * - `is_archived` on a row we own: the channel is permanently dead, so drop
 *   the orphan Review row and log at info (operational state, not failure).
 *   The Project↔channel link is left intact so the integration recovers if
 *   the channel is later unarchived.
 * - anything else: surface via the structured error log introduced for
 *   webhook drop visibility.
 */
export async function handleReviewWebhookError(
  err: unknown,
  ctx: ReviewWebhookErrorContext,
  transaction?: Transaction,
): Promise<void> {
  if (isSlackErrorCode(err, IS_ARCHIVED_SLACK_ERROR) && ctx.reviewTs) {
    logger.info(
      { ...ctx, slackError: IS_ARCHIVED_SLACK_ERROR },
      'slack channel archived; removing orphan review',
    );
    await removeReview(ctx.reviewTs, transaction);
    return;
  }

  logger.error({ err, ...ctx }, 'webhook slack work failed');
}
