export interface HttpCallMock {
  called: boolean;
  calledWith: unknown[] | undefined;
  response: unknown;
}

const { default: realNodeFetch } = jest.requireActual('node-fetch');
let nodeFetchMocks = {} as Record<string, HttpCallMock>;

export default (url: string, ...args: any[]) => {
  if (url.includes('git.manomano.tech') || url.includes('slack')) {
    if (!nodeFetchMocks[url]) {
      throw new Error(`Non mocked URL: ${url}`);
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
