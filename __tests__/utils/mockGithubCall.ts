import { CONFIG } from '@/config';
import type { HttpCallMock } from '@root/__mocks__/fetch-mock';
import { mockUrl } from '@root/__mocks__/fetch-mock';

export function mockGithubCall(
  path: string,
  response: unknown,
  status?: number,
): HttpCallMock {
  return mockUrl(`${CONFIG.github.apiUrl}${path}`, response, status);
}
