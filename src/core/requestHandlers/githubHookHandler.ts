import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { logger } from '@/core/services/logger';
import { reviewHookHandler } from '@/review/reviewHookHandler';

/**
 * GitHub webhook handler
 * Routes incoming GitHub webhook events to appropriate handlers
 *
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads
 */
export async function githubHookHandler(
  req: Request,
  res: Response
): Promise<void> {
  const githubEvent = req.headers['x-github-event'] as string;
  const repoName = req.body?.repository?.full_name || 'unknown';
  const action = req.body?.action;

  logger.info(
    `GitHub webhook received: event=${githubEvent}, repo=${repoName}, action=${
      action || 'N/A'
    }`
  );

  // Route based on GitHub event type
  switch (githubEvent) {
    case 'pull_request':
    case 'pull_request_review':
    case 'pull_request_review_comment':
      // Handle PR events through review handler
      logger.debug(
        `Routing ${githubEvent} event to reviewHookHandler for ${repoName}`
      );
      return reviewHookHandler(req, res);

    case 'issue_comment':
      // GitHub sends PR comments as issue_comment events
      // Only handle if it's actually a PR comment
      if (req.body?.issue?.pull_request) {
        logger.debug(
          `Routing issue_comment (PR comment) event to reviewHookHandler for ${repoName}`
        );
        return reviewHookHandler(req, res);
      }
      logger.debug(`Ignoring issue_comment event (not a PR) for ${repoName}`);
      res.sendStatus(HTTP_STATUS_NO_CONTENT);
      return;

    case 'ping':
      // GitHub sends a ping event when webhook is first created
      logger.info(`GitHub webhook ping received from ${repoName}`);
      res.status(200).json({ message: 'pong' });
      return;

    default:
      logger.debug(
        `Unhandled GitHub webhook event: ${githubEvent} from ${repoName}`
      );
      res.sendStatus(HTTP_STATUS_NO_CONTENT);
  }
}
