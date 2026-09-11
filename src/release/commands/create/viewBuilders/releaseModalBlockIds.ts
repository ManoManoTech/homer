import { buildBlockId } from '@/core/utils/buildBlockId';

/**
 * Action ids are the stable contract of the release modal: block ids of the
 * inputs are rotated so that Slack rebuilds them instead of preserving their
 * previous value, hence the view state must always be read by action id.
 */
export const RELEASE_SELECT_PROJECT_ACTION_ID = 'release-select-project-action';
export const RELEASE_TAG_ACTION_ID = 'release-tag-action';
export const RELEASE_SELECT_PREVIOUS_TAG_ACTION_ID =
  'release-select-previous-tag-action';

/** Stable: the user selection must be preserved, and it is a splice anchor. */
export const RELEASE_PROJECT_BLOCK_ID = 'release-project-block';

/** Stable: holds no state, and it is a splice anchor. */
export const RELEASE_PREVIOUS_TAG_INFO_BLOCK_ID =
  'release-previous-tag-info-block';

export const RELEASE_CHANGELOG_BLOCK_ID = 'release-changelog-block';

/** Rotates whenever the release tag suggestion changes. */
export function buildReleaseTagBlockId(
  projectId: number,
  previousReleaseTagName: string | undefined,
): string {
  return buildBlockId('release-tag-block', projectId, previousReleaseTagName);
}

/** Rotates whenever the available release tags change. */
export function buildPreviousReleaseTagBlockId(projectId: number): string {
  return buildBlockId('release-previous-tag-block', projectId);
}
