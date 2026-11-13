import { webcrypto } from 'crypto';
import { pullRequestOpenedHookFixture } from '../__fixtures__/hooks/github/pullRequestHookFixture';
import { GITHUB_WEBHOOK_SECRET, getGithubHeaders } from './getGithubHeaders';

/**
 * Computed with WebCrypto rather than `crypto.createHmac`, so the expectation
 * does not come from the same code path as the helper under test.
 */
async function signWithWebCrypto(secret: string, rawBody: string) {
  const encoder = new TextEncoder();
  const key = await webcrypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await webcrypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(rawBody),
  );

  return `sha256=${Buffer.from(signature).toString('hex')}`;
}

describe('getGithubHeaders', () => {
  it('matches the signature published in GitHub webhook documentation', () => {
    const headers = getGithubHeaders(
      'push',
      'Hello, World!',
      undefined,
      "It's a Secret to Everybody",
    );

    expect(headers['X-Hub-Signature-256']).toEqual(
      'sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17',
    );
  });

  it('signs a pull request payload so an independent HMAC implementation agrees', async () => {
    const body = JSON.stringify(pullRequestOpenedHookFixture);
    const headers = getGithubHeaders('pull_request', body);

    expect(headers['X-Hub-Signature-256']).toEqual(
      await signWithWebCrypto(GITHUB_WEBHOOK_SECRET, body),
    );
  });

  it('signs the serialised form of a body passed as an object', async () => {
    const headers = getGithubHeaders(
      'pull_request',
      pullRequestOpenedHookFixture as unknown as Record<string, unknown>,
    );

    expect(headers['X-Hub-Signature-256']).toEqual(
      await signWithWebCrypto(
        GITHUB_WEBHOOK_SECRET,
        JSON.stringify(pullRequestOpenedHookFixture),
      ),
    );
  });

  it('signs the raw bytes rather than the parsed body', () => {
    const compact = getGithubHeaders('push', '{"a":1}');
    const spaced = getGithubHeaders('push', '{ "a": 1 }');

    expect(compact['X-Hub-Signature-256']).not.toEqual(
      spaced['X-Hub-Signature-256'],
    );
  });

  it('produces a different signature under a different secret', () => {
    const withFixtureSecret = getGithubHeaders('push', '{"a":1}');
    const withOtherSecret = getGithubHeaders(
      'push',
      '{"a":1}',
      undefined,
      'another-secret',
    );

    expect(withFixtureSecret['X-Hub-Signature-256']).not.toEqual(
      withOtherSecret['X-Hub-Signature-256'],
    );
  });

  it('sends the event, the delivery id and a Hookshot user agent', () => {
    const headers = getGithubHeaders('pull_request_review', {}, 'delivery-1');

    expect(headers['X-GitHub-Event']).toEqual('pull_request_review');
    expect(headers['X-GitHub-Delivery']).toEqual('delivery-1');
    expect(headers['User-Agent']).toMatch(/^GitHub-Hookshot\//);
  });
});
