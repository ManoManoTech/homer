import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { CONFIG } from '@/config';
import { logger } from '@/core/services/logger';

const GITLAB_SECRET = CONFIG.gitlab.secret;
const GITHUB_SECRET = CONFIG.github.secret;
const SLACK_SIGNING_SECRET = CONFIG.slack.signingSecret;
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
        `Gitlab request received with wrong secret from '${projectPath}'`,
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
 * Validates requests from GitHub.
 *
 * @see https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
function isValidGitHubRequest(req: Request): boolean {
  const isGitHubRequest = req.header('X-GitHub-Event') !== undefined;

  if (!isGitHubRequest) {
    return false;
  }

  // GitHub uses X-Hub-Signature-256 (SHA256) or X-Hub-Signature (SHA1, deprecated)
  const signature = req.header('X-Hub-Signature-256');

  if (!signature) {
    const repoName = req.body?.repository?.full_name;
    logger.error(
      `GitHub webhook received without signature${
        repoName ? ` from '${repoName}'` : ''
      }`
    );
    logger.debug('Missing X-Hub-Signature-256 header');
    return false;
  }

  const { rawBody } = req as any;
  if (!rawBody) {
    logger.error('GitHub webhook validation failed: rawBody not available');
    return false;
  }

  // Validate HMAC SHA-256 signature
  const hmac = crypto.createHmac('sha256', GITHUB_SECRET);
  hmac.update(rawBody);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;

  if (signature !== expectedSignature) {
    const repoName = req.body?.repository?.full_name;
    logger.error(
      `GitHub webhook received with invalid signature${
        repoName ? ` from '${repoName}'` : ''
      }`
    );
    logger.debug({
      receivedSignature: signature,
      expectedPrefix: `${expectedSignature.substring(0, 15)}...`,
    });
    return false;
  }

  logger.debug(
    `GitHub webhook validated successfully from ${
      req.body?.repository?.full_name || 'unknown repo'
    }`
  );
  return true;
}

/**
 * Allows only secure requests from Gitlab, GitHub, or Slack.
 */
export function securityMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (
    !isValidGitlabRequest(req) &&
    !isValidGitHubRequest(req) &&
    !isValidSlackRequest(req)
  ) {
    logger.debug('Unauthorized request received');
    res.status(401).send('Unauthorized');
  } else {
    next();
  }
}
