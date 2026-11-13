import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { CONFIG } from '@/config';
import { logger } from '@/core/services/logger';

const GITHUB_SECRET = CONFIG.github.secret;
const GITLAB_SECRET = CONFIG.gitlab.secret;
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
 * Validates requests from GitHub.
 *
 * @see https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
function isValidGithubRequest(req: Request): boolean {
  const isGithubRequest = req.header('X-GitHub-Event') !== undefined;

  if (!isGithubRequest) {
    return false;
  }

  if (GITHUB_SECRET === '') {
    logger.error('GitHub request received but GITHUB_SECRET is not set');
    return false;
  }

  const rawBody: Buffer | undefined = (req as any).rawBody;

  // The body parsers capture it; without it every signature looks wrong.
  if (rawBody === undefined) {
    logger.error(
      'GitHub request received without raw body, check the body parser setup',
    );
    return false;
  }

  const signature = Buffer.from(req.header('X-Hub-Signature-256') ?? '');
  const expectedSignature = Buffer.from(
    `sha256=${crypto
      .createHmac('sha256', GITHUB_SECRET)
      .update(rawBody)
      .digest('hex')}`,
  );

  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(signature, expectedSignature)
  ) {
    const repositoryName = req.body?.repository?.full_name;

    if (repositoryName) {
      logger.error(
        `GitHub request received with wrong signature from '${repositoryName}'`,
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

export type RequestSource = 'github' | 'gitlab' | 'slack';

function getRequestSource(req: Request): RequestSource | undefined {
  if (isValidGithubRequest(req)) return 'github';
  if (isValidGitlabRequest(req)) return 'gitlab';
  if (isValidSlackRequest(req)) return 'slack';
  return undefined;
}

/**
 * Allows only secure requests from GitHub, Gitlab or Slack, and stores the
 * verified source for `requireRequestSource`.
 */
export function securityMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const source = getRequestSource(req);

  if (source === undefined) {
    logger.debug('Unauthorized request received');
    res.status(401).send('Unauthorized');
  } else {
    res.locals.requestSource = source;
    next();
  }
}

/**
 * Restricts a route to requests verified for the given source, so a payload
 * signed for one provider is never handled as another one.
 */
export function requireRequestSource(source: RequestSource) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (res.locals.requestSource !== source) {
      logger.debug(`Request not verified as coming from ${source}`);
      res.status(401).send('Unauthorized');
    } else {
      next();
    }
  };
}
