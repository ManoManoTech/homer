import request from 'supertest';
import { app } from '@/app';
import * as data from '@/core/services/data';

describe('core > readiness', () => {
  it('should answer 200 when database is reachable', async () => {
    // When
    const response = await request(app).get('/api/monitoring/readiness');

    // Then
    expect(response.status).toEqual(200);
    expect(response.text).toBe('ready');
  });

  it('should answer 503 when database is not reachable', async () => {
    // Given
    jest
      .spyOn(data, 'checkDatabaseConnection')
      .mockRejectedValue(new Error('Connection refused'));

    // When
    const response = await request(app).get('/api/monitoring/readiness');

    // Then
    expect(response.status).toEqual(503);
    expect(response.text).toBe('Database connection failed');
  });
});
