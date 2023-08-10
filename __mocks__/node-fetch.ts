export interface HttpCallMock {
  called: boolean;
  calledWith: unknown[] | undefined;
  response: unknown;
}

const { default: realNodeFetch } = jest.requireActual('node-fetch');
let nodeFetchMocks: Record<string, HttpCallMock> = {};

export default (url: string, ...args: any[]) => {
  if (url.includes('git.manomano.tech') || url.includes('slack')) {
    if (!nodeFetchMocks[url]) {
      // eslint-disable-next-line no-console
      console.error(`Non mocked URL: ${url}`);
      return;
    }
    nodeFetchMocks[url].called = true;
    nodeFetchMocks[url].calledWith = [url, ...args];
    return nodeFetchMocks[url].response;
  }
  return realNodeFetch(url, ...args);
};

export function clearNodeFetchMock(): void {
  nodeFetchMocks = {};
}

export function mockUrl(url: string, response: unknown): HttpCallMock {
  nodeFetchMocks[url] = { called: false, calledWith: undefined, response };
  return nodeFetchMocks[url];
}
