import request from 'supertest';
import { app } from '@/app';
import { getGithubHeaders } from '../utils/getGithubHeaders';

describe('core > security > GitHub', () => {
  it('should allow signed GitHub requests', async () => {
    // Given
    const body = { zen: 'Keep it logically awesome.' };

    // When
    const response = await request(app)
      .post('/api/v1/homer/github')
      .set(getGithubHeaders('ping', body))
      .send(body);

    // Then
    expect(response.status).toEqual(200);
  });

  it('should not allow GitHub requests with a wrong signature', async () => {
    // Given
    const body = { zen: 'Keep it logically awesome.' };
    const headers = getGithubHeaders('ping', { other: 'body' });

    // When
    const response = await request(app)
      .post('/api/v1/homer/github')
      .set(headers)
      .send(body);

    // Then
    expect(response.status).toEqual(401);
  });

  it('should not allow unsigned GitHub requests', async () => {
    // Given
    const body = { zen: 'Keep it logically awesome.' };
    const headers = getGithubHeaders('ping', body);
    delete headers['X-Hub-Signature-256'];

    // When
    const response = await request(app)
      .post('/api/v1/homer/github')
      .set(headers)
      .send(body);

    // Then
    expect(response.status).toEqual(401);
  });

  it('should ignore unhandled GitHub events', async () => {
    // Given
    const body = { action: 'created' };

    // When
    const response = await request(app)
      .post('/api/v1/homer/github')
      .set(getGithubHeaders('star', body))
      .send(body);

    // Then
    expect(response.status).toEqual(204);
  });
});
