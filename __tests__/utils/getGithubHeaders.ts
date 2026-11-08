import crypto from 'node:crypto';
import { CONFIG } from '@/config';

export function getGithubHeaders(
  event: string,
  body: unknown = {},
): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-GitHub-Event': event,
    'X-Hub-Signature-256': `sha256=${crypto
      .createHmac('sha256', CONFIG.github.secret)
      .update(JSON.stringify(body))
      .digest('hex')}`,
  };
}
