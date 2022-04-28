import { HTTP_STATUS_OK } from '@/constants';
import { fetch } from '../utils/fetch';

describe('core > healthCheck', () => {
  it('should answer 200', async () => {
    // When
    const response = await fetch('/api/monitoring/healthcheck', {
      method: 'get',
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
  });
});
