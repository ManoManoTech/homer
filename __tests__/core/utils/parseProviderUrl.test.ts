import { parseProviderUrl } from '@/core/utils/parseProviderUrl';

describe('parseProviderUrl', () => {
  it('should parse GitHub URLs', () => {
    const result = parseProviderUrl('https://github.com/owner/repo/pull/123');
    expect(result).toEqual({
      provider: 'github',
      projectId: 'owner/repo',
      number: 123,
      url: 'https://github.com/owner/repo/pull/123',
    });
  });

  it('should parse GitLab URLs with https', () => {
    const result = parseProviderUrl(
      'https://gitlab.com/org/repo/-/merge_requests/456'
    );
    expect(result).toEqual({
      provider: 'gitlab',
      projectId: 'org/repo',
      number: 456,
      url: 'https://gitlab.com/org/repo/-/merge_requests/456',
    });
  });

  it('should parse GitLab URLs with http', () => {
    const result = parseProviderUrl(
      'http://gitlab.example.com/diaspora/diaspora-project-site/-/merge_requests/1'
    );
    expect(result).toEqual({
      provider: 'gitlab',
      projectId: 'diaspora/diaspora-project-site',
      number: 1,
      url: 'http://gitlab.example.com/diaspora/diaspora-project-site/-/merge_requests/1',
    });
  });

  it('should parse GitLab URLs with nested groups', () => {
    const result = parseProviderUrl(
      'https://gitlab.com/group/subgroup/project/-/merge_requests/789'
    );
    expect(result).toEqual({
      provider: 'gitlab',
      projectId: 'group/subgroup/project',
      number: 789,
      url: 'https://gitlab.com/group/subgroup/project/-/merge_requests/789',
    });
  });

  it('should return null for non-URL strings', () => {
    expect(parseProviderUrl('fix: bug #123')).toBeNull();
    expect(parseProviderUrl('!123')).toBeNull();
    expect(parseProviderUrl('123')).toBeNull();
    expect(parseProviderUrl('')).toBeNull();
  });

  it('should return null for invalid URLs', () => {
    expect(parseProviderUrl('https://example.com/some/path')).toBeNull();
    expect(
      parseProviderUrl('https://github.com/owner/repo/issues/123')
    ).toBeNull();
  });
});
