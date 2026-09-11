import { buildBlockId } from '@/core/utils/buildBlockId';

/**
 * Action ids are the stable contract of the changelog modal: block ids of the
 * inputs are rotated so that Slack rebuilds them instead of preserving their
 * previous value, hence the view state must always be read by action id.
 */
export const CHANGELOG_SELECT_PROJECT_ACTION_ID =
  'changelog-select-project-action';
export const CHANGELOG_SELECT_RELEASE_TAG_ACTION_ID =
  'changelog-select-release-tag-action';
export const CHANGELOG_MARKDOWN_ACTION_ID = 'changelog-markdown-action';

/** Stable: the user selection must be preserved, and it is a splice anchor. */
export const CHANGELOG_PROJECT_BLOCK_ID = 'changelog-project-block';

/** Stable: holds no state, and it is a splice anchor. */
export const CHANGELOG_RELEASE_TAG_INFO_BLOCK_ID =
  'changelog-release-tag-info-block';

export const CHANGELOG_PREVIEW_TITLE_BLOCK_ID = 'changelog-preview-title-block';
export const CHANGELOG_PREVIEW_BLOCK_ID = 'changelog-preview-block';

/** Rotates whenever the available release tags change. */
export function buildChangelogReleaseTagBlockId(projectId: number): string {
  return buildBlockId('changelog-release-tag-block', projectId);
}

/** Rotates whenever the generated changelog changes. */
export function buildChangelogMarkdownBlockId(
  projectId: number,
  releaseTagName: string | undefined,
): string {
  return buildBlockId('changelog-markdown-block', projectId, releaseTagName);
}
