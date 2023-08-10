import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '@/core/services/logger';
import { getEnvVariable } from '@/core/utils/getEnvVariable';

const GITLAB_SECRET = getEnvVariable('GITLAB_SECRET');
const SLACK_SIGNING_SECRET = getEnvVariable('SLACK_SIGNING_SECRET');
const SLACK_REQUEST_MAX_AGE_SECONDS = 5 * 60;

/**
 * Validates requests from Gitlab.
 *
 * @see https://docs.gitlab.com/ee/user/project/integrations/webhooks.html#secret-token
 */
function isValidGitlabRequest(req: Request): boolean {
  const isGitlabRequest = req.header('X-Gitlab-Event') !== undefined;

  if (!isGitlabRequest) {
    return false;
  }

  if (req.header('X-Gitlab-Token') !== GITLAB_SECRET) {
    const projectPath = req.body?.project?.path_with_namespace;

    if (projectPath) {
      logger.error(
        `Gitlab request received with wrong secret from '${projectPath}'`
      );
    }
    return false;
  }
  return true;
}

/**
 * Validates requests from Slack.
 *
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */
function isValidSlackRequest(req: Request): boolean {
  const userAgent = req.header('User-Agent') || '';

  if (!userAgent.includes('Slackbot')) {
    return false; // Not a request from slack
  }

  const requestTimestamp = Number(req.header('X-Slack-Request-Timestamp'));

  if (
    !Number.isInteger(requestTimestamp) ||
    Date.now() / 1000 - requestTimestamp > SLACK_REQUEST_MAX_AGE_SECONDS
  ) {
    logger.error('Slack request received with no timestamp or too old');
    return false;
  }

  const requestSignature = req.header('X-Slack-Signature');
  const signingBaseString = `v0:${requestTimestamp}:${(req as any).rawBody}`;
  const signingBaseHash = `v0=${crypto
    .createHmac('sha256', SLACK_SIGNING_SECRET)
    .update(signingBaseString)
    .digest('hex')}`;

  if (requestSignature !== signingBaseHash) {
    logger.debug({ requestSignature, signingBaseString, signingBaseHash });
    logger.error('Slack request received with wrong signature');
    return false;
  }
  return true;
}

/**
 * Allows only secure requests from Gitlab or Slack.
 */
export function securityMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!isValidGitlabRequest(req) && !isValidSlackRequest(req)) {
    logger.debug('Unauthorized request received');
    res.status(401).send('Unauthorized');
  } else {
    next();
  }
}
