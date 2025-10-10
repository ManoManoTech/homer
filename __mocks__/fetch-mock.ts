export interface HttpCallMock {
  called: boolean;
  calledWith: [Request | URL, RequestInit | undefined] | undefined;
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

export function createFetchMock(originalFetch: typeof fetch) {
  return async (
    input: Request | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = typeof input === 'string' ? input : (input as URL).toString();

    if (url.includes('my-git.domain.com') || url.includes('slack')) {
      const mock = fetchMocks[url];

      if (!mock) {
        throw new Error(`Unmocked fetch call to intercepted URL: ${url}`);
      }

      mock.called = true;
      mock.calledWith = [input, init];

      const response = new Response(JSON.stringify(mock.responseBody), {
        status: mock.status,
        headers: { 'Content-Type': 'application/json' },
      });

      return Promise.resolve(response);
    }

    return originalFetch(input, init);
  };
}
