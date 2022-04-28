import { fetch } from '../utils/fetch';
import { getGitlabHeaders } from '../utils/getGitlabHeaders';
import { getSlackHeaders } from '../utils/getSlackHeaders';

describe('core > security', () => {
  it('should not allow unknown requests', async () => {
    // When
    const response = await fetch('/api/v1/homer/cat', {
      headers: { 'User-Agent': '' },
    });

    // Then
    expect(response.status).toEqual(401);
  });

  it('should not allow unverified Gitlab requests', async () => {
    // When
    const headers = getGitlabHeaders();
    delete headers['X-Gitlab-Token'];
    const response = await fetch('/api/v1/homer/cat', { headers });

    // Then
    expect(response.status).toEqual(401);
  });

  it('should allow verified Gitlab requests', async () => {
    // When
    const response = await fetch('/api/v1/homer/cat', {
      headers: getGitlabHeaders(),
    });

    // Then
    expect(response.status).toEqual(404);
  });

  it('should allow verified Slack requests', async () => {
    // When
    const response = await fetch('/api/v1/homer/chat', {
      headers: getSlackHeaders(),
    });

    // Then
    expect(response.status).toEqual(404);
  });

  it('should not allow Slack requests with wrong signature', async () => {
    // Given
    const headers = getSlackHeaders();
    headers['X-Slack-Signature'] = 'bad signature';

    // When
    const response = await fetch('/api/v1/homer/chat', { headers });

    // Then
    expect(response.status).toEqual(401);
  });

  it('should not allow too old Slack requests', async () => {
    // When
    const response = await fetch('/api/v1/homer/chat', {
      headers: getSlackHeaders({}, Date.now() - 60 * 60 * 1000),
    });

    // Then
    expect(response.status).toEqual(401);
  });
});
