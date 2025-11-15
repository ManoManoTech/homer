export interface HttpCallMock {
  called: boolean;
  calledWith: [string | URL, RequestInit | undefined] | undefined;
  responseBody: unknown;
  status?: number;
}

let fetchMocks: Record<string, HttpCallMock> = {};

export function clearFetchMocks(): void {
  fetchMocks = {};
}

export function mockUrl(
  url: string,
  responseBody: unknown,
  status = 200,
): HttpCallMock {
  fetchMocks[url] = {
    called: false,
    calledWith: undefined,
    responseBody,
    status,
  };
  return fetchMocks[url];
}

export function mockFetch(mocks: Record<string, unknown>, status = 200): void {
  Object.entries(mocks).forEach(([url, responseBody]) => {
    mockUrl(url, responseBody, status);
  });
}

export function createFetchMock(originalFetch: any) {
  return async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : (input as URL).toString();

    if (url.includes('my-git.domain.com') || url.includes('slack')) {
      const mock = fetchMocks[url];

      if (!mock) {
        throw new Error(`Unmocked fetch call to intercepted URL: ${url}`);
      }

      mock.called = true;
      mock.calledWith = [input, init];

      // Return a mock response object
      return Promise.resolve({
        json: async () => mock.responseBody,
        status: mock.status,
        ok: (mock.status || 200) >= 200 && (mock.status || 200) < 300,
        headers: new Map([['Content-Type', 'application/json']]),
      } as any as Response);
    }

    return originalFetch(input, init);
  };
}
