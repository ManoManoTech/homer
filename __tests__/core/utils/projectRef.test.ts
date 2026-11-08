import { formatProjectRef, parseProjectRef } from '@/core/utils/projectRef';

describe('projectRef', () => {
  it('keeps the bare id for GitLab projects', () => {
    expect(formatProjectRef({ provider: 'gitlab', projectId: 12 })).toBe('12');
    expect(parseProjectRef('12')).toEqual({
      provider: 'gitlab',
      projectId: 12,
    });
  });

  it('prefixes GitHub projects', () => {
    expect(formatProjectRef({ provider: 'github', projectId: 12 })).toBe(
      'github:12',
    );
    expect(parseProjectRef('github:12')).toEqual({
      provider: 'github',
      projectId: 12,
    });
  });

  it('rejects unknown providers', () => {
    expect(() => parseProjectRef('bitbucket:12')).toThrow();
  });
});
