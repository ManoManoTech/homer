import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { logger } from '@/core/services/logger';
import { mergeRequestNoteHookFixture } from '../__fixtures__/mergeRequestNoteBody';
import { getGitlabHeaders } from '../utils/getGitlabHeaders';

// In tests the body-parser limit is constrained to 500kb (see
// config/jest/setupAfterEnv.ts) so the size-limit code path can be exercised
// with small fixtures.
const TEST_LIMIT_BYTES = 500 * 1024;

describe('app body-parser size limit', () => {
  it('accepts a GitLab webhook payload below the configured limit', async () => {
    // Given: a note ~100 KiB, well below the 500 KiB test limit.
    const note = 'x'.repeat(100 * 1024);
    const payload = {
      ...mergeRequestNoteHookFixture,
      object_attributes: {
        ...mergeRequestNoteHookFixture.object_attributes,
        note,
      },
    };

    // When
    const response = await request(app)
      .post('/api/v1/homer/gitlab')
      .set(getGitlabHeaders())
      .send(payload);

    // Then: request reaches noteHookHandler (no matching review → 204).
    expect(response.status).toBe(HTTP_STATUS_NO_CONTENT);
    expect(logger.error).not.toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({ type: 'entity.too.large' }),
      }),
      expect.anything(),
    );
  });

  it('logs a structured warning with Content-Length when the payload exceeds the configured limit', async () => {
    // Given: a payload slightly above the test limit (~600 KiB).
    const oversized = 'y'.repeat(TEST_LIMIT_BYTES + 100 * 1024);
    const payload = {
      ...mergeRequestNoteHookFixture,
      object_attributes: {
        ...mergeRequestNoteHookFixture.object_attributes,
        note: oversized,
      },
    };

    // When
    await request(app)
      .post('/api/v1/homer/gitlab')
      .set(getGitlabHeaders())
      .send(payload);

    // Then
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({ type: 'entity.too.large' }),
        contentLength: expect.any(String),
      }),
      'request body exceeded size limit',
    );
  });
});
