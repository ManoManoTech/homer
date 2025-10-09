import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_OK } from '@/constants';

describe('core > healthCheck', () => {
  it('should answer 200', async () => {
    // When
    const response = await request(app).get('/api/monitoring/healthcheck');

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
  });
});
