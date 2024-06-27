import type { ReleaseTagManager } from '../../../typings/ReleaseTagManager';

/** x.x.x (semantic versioning) */
function createReleaseTag(previousReleaseTag?: string): string {
  if (previousReleaseTag === undefined) {
    return '1.0.0';
  }

  const [prefix, major, minor, patch] =
    previousReleaseTag.match(/(v?)(\d+)\.(\d+)\.(\d+)/)?.slice(1) ?? [];

  return `${prefix}${major}.${minor}.${Number(patch) + 1}`;
}

function isReleaseTag(tag: string): boolean {
  return /\d+\.\d+\.\d+/.test(tag);
}

export const semanticReleaseTagManager: ReleaseTagManager = {
  createReleaseTag,
  isReleaseTag,
};
