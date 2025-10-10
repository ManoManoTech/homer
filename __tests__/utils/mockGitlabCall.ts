import { CONFIG } from '@/config';
import type { HttpCallMock } from '@root/__mocks__/fetch-mock';
import { mockUrl } from '@root/__mocks__/fetch-mock';

export function mockGitlabCall(url: string, response: unknown): HttpCallMock {
  return mockUrl(
    `${CONFIG.gitlab.url}/api/v4${url}${
      url.includes('?') ? '&' : '?'
    }private_token=${CONFIG.gitlab.token}`,
    response,
  );
}
