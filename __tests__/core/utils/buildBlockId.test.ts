import { buildBlockId } from '@/core/utils/buildBlockId';

/** Slack rejects any `block_id` longer than 255 characters. */
const MAX_BLOCK_ID_LENGTH = 255;

describe('core > utils > buildBlockId', () => {
  it('should join the prefix and the parts', () => {
    expect(
      buildBlockId('release-tag-block', 1148, 'stable-20200101-1000'),
    ).toEqual('release-tag-block-1148-stable-20200101-1000');
  });

  it('should mark the missing parts, so that ids of different arities differ', () => {
    expect(buildBlockId('release-tag-block', 1148, undefined)).toEqual(
      'release-tag-block-1148-none',
    );
    expect(buildBlockId('release-tag-block', 1148, undefined)).not.toEqual(
      buildBlockId('release-tag-block', 1148),
    );
  });

  it('should replace the characters Slack could choke on', () => {
    expect(
      buildBlockId('changelog-markdown-block', 1148, 'v1.2.3+rc 1/2'),
    ).toEqual('changelog-markdown-block-1148-v1.2.3_rc_1_2');
  });

  it('should hash the id whether it exceeds the length allowed by Slack', () => {
    const blockId = buildBlockId('release-tag-block', 'a'.repeat(300));

    expect(blockId.length).toBeLessThanOrEqual(MAX_BLOCK_ID_LENGTH);
    expect(blockId).toMatch(/^release-tag-block-[0-9a-f]{16}$/);
  });

  it('should not collide when hashing two different long values', () => {
    expect(
      buildBlockId('release-tag-block', `${'a'.repeat(300)}1`),
    ).not.toEqual(buildBlockId('release-tag-block', `${'a'.repeat(300)}2`));
  });
});
