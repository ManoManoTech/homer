import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { logger } from '@/core/services/logger';
import { ProviderFactory } from '@/core/services/providers/ProviderFactory';
import { mergeRequestHookHandler } from './commands/share/hookHandlers/mergeRequestHookHandler';
import { noteHookHandler } from './commands/share/hookHandlers/noteHookHandler';
import { pushHookHandler } from './commands/share/hookHandlers/pushHookHandler';

export async function reviewHookHandler(
  req: Request,
  res: Response
): Promise<void> {
  const { object_kind } = req.body;

  // GitLab webhook detected
  if (object_kind) {
    const projectPath = req.body?.project?.path_with_namespace;
    logger.debug(
      `GitLab webhook detected: object_kind=${object_kind}, project=${
        projectPath || 'unknown'
      }`
    );

    switch (object_kind) {
      case 'merge_request':
        return mergeRequestHookHandler(req, res);

      case 'note':
        return noteHookHandler(req, res);

      case 'push':
        return pushHookHandler(req, res);

      default:
        logger.debug(
          `Ignoring GitLab webhook with unhandled object_kind: ${object_kind}`
        );
        res.sendStatus(HTTP_STATUS_NO_CONTENT);
        return;
    }
  }

  // GitHub webhook detection
  const githubEvent = req.headers['x-github-event'];
  if (githubEvent) {
    const repoName = req.body?.repository?.full_name;
    logger.debug(
      `GitHub webhook detected: event=${githubEvent}, repo=${
        repoName || 'unknown'
      }`
    );

    // Use GitHub provider to parse webhook
    const githubProvider = ProviderFactory.getProvider('github');
    const webhookEvent = githubProvider.parseWebhookEvent(
      req.headers as Record<string, string>,
      req.body
    );

    if (!webhookEvent) {
      logger.debug(
        `GitHub webhook event ${githubEvent} not parsed (null returned)`
      );
      res.sendStatus(HTTP_STATUS_NO_CONTENT);
      return;
    }

    logger.debug(
      `GitHub webhook parsed as type=${webhookEvent.type}, action=${
        webhookEvent.action || 'N/A'
      }`
    );

    // Route to appropriate handler based on event type
    switch (webhookEvent.type) {
      case 'pull_request':
        // Reuse GitLab merge request handler with unified model
        return mergeRequestHookHandler(req, res);

      case 'note':
        // Reuse GitLab note handler
        return noteHookHandler(req, res);

      default:
        logger.debug(
          `Ignoring GitHub webhook with unhandled type: ${webhookEvent.type}`
        );
        res.sendStatus(HTTP_STATUS_NO_CONTENT);
        return;
    }
  }

  // Unknown webhook format
  logger.warn(
    'Received webhook with unknown format (neither GitLab nor GitHub)'
  );
  res.sendStatus(HTTP_STATUS_NO_CONTENT);
}
