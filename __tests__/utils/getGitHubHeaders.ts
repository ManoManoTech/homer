import crypto from 'crypto';

export function getGitHubHeaders(
  event: string,
  payload: string
): Record<string, string> {
  const secret = process.env.GITHUB_SECRET as string;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const signature = `sha256=${hmac.digest('hex')}`;

  return {
    'x-github-event': event,
    'x-hub-signature-256': signature,
    'content-type': 'application/json',
  };
}
