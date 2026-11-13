import crypto from 'crypto';

/**
 * Homer has no GitHub configuration yet, so the secret is a fixture value. Once
 * `CONFIG.github.secret` exists this default should read it, the way
 * `getGitlabHeaders` reads `CONFIG.gitlab.secret`.
 */
export const GITHUB_WEBHOOK_SECRET = 'github-webhook-secret';

const DEFAULT_DELIVERY_ID = 'd1e2f3a4-b5c6-4d7e-8f90-1a2b3c4d5e6f';

/**
 * GitHub signs the raw request body, so the signature has to be computed over
 * the exact bytes that are sent. Passing an object here serialises it the same
 * way a JSON request body would be, but a caller that sends a pre-serialised
 * string must pass that string, not the object it came from.
 */
export function getGithubHeaders(
  event: string,
  body: string | Record<string, unknown> = {},
  deliveryId: string = DEFAULT_DELIVERY_ID,
  secret: string = GITHUB_WEBHOOK_SECRET,
): Record<string, string> {
  const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
  const signature = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')}`;

  return {
    'User-Agent': 'GitHub-Hookshot/044aadd',
    'X-GitHub-Event': event,
    'X-GitHub-Delivery': deliveryId,
    'X-Hub-Signature-256': signature,
  };
}
