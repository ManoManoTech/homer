import { mockUrl } from '../../__mocks__/fetch-mock';
import type { HttpCallMock } from '../../__mocks__/fetch-mock';

export function mockGitHubCall(url: string, response: unknown): HttpCallMock {
  return mockUrl(`https://api.github.com${url}`, response);
}
