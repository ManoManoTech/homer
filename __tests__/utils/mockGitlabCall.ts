import { getEnvVariable } from '@/core/utils/getEnvVariable';
import type { HttpCallMock } from '../../__mocks__/node-fetch';

export function mockGitlabCall(url: string, response: unknown): HttpCallMock {
  // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
  const { mockUrl } = require('node-fetch') as any;

  return mockUrl(
    `${getEnvVariable('GITLAB_URL')}/api/v4${url}${
      url.includes('?') ? '&' : '?'
    }private_token=${process.env.GITLAB_TOKEN}`,
    { json: () => Promise.resolve(response) }
  );
}
