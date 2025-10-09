import { CONFIG } from '@/config';
import type { HttpCallMock } from '../../__mocks__/node-fetch';

export function mockGitlabCall(url: string, response: unknown): HttpCallMock {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockUrl } = require('node-fetch') as any;

  return mockUrl(
    `${CONFIG.gitlab.url}/api/v4${url}${
      url.includes('?') ? '&' : '?'
    }private_token=${CONFIG.gitlab.token}`,
    { json: () => Promise.resolve(response) },
  );
}
