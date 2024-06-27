import { semanticReleaseTagManager } from '../semanticReleaseTagManager';

describe('semanticReleaseTagManager', () => {
  describe('createReleaseTag', () => {
    it('should create a tag', () => {
      expect(semanticReleaseTagManager.createReleaseTag('1.2.3')).toEqual(
        '1.2.4'
      );
    });

    it('should keep v prefix', () => {
      expect(semanticReleaseTagManager.createReleaseTag('v1.2.3')).toEqual(
        'v1.2.4'
      );
    });

    it('should filter non v prefixes', () => {
      expect(semanticReleaseTagManager.createReleaseTag('prefix1.2.3')).toEqual(
        '1.2.4'
      );
    });

    it('should filter suffixes', () => {
      expect(
        semanticReleaseTagManager.createReleaseTag('1.2.3-suffix-test-123')
      ).toEqual('1.2.4');
    });
  });

  describe('isReleaseTag', () => {
    it('should detect regular tags', () => {
      expect(semanticReleaseTagManager.isReleaseTag('1.2.3')).toEqual(true);
    });

    it('should detect tags starting with non numeric value', () => {
      expect(semanticReleaseTagManager.isReleaseTag('v1.2.3')).toEqual(true);
    });

    it('should detect tags ending with non numeric value', () => {
      expect(semanticReleaseTagManager.isReleaseTag('1.2.3-beta')).toEqual(
        true
      );
    });
  });
});
