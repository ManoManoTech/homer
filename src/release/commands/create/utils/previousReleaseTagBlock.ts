const PREVIOUS_RELEASE_TAG_BLOCK_ID_PREFIX = 'release-previous-tag-block';

export const SELECT_PREVIOUS_RELEASE_TAG_ACTION_ID =
  'release-select-previous-tag-action';

/**
 * Slack keeps the value already entered in an input whose block_id and
 * action_id are unchanged between two views.update calls, ignoring the
 * initial_option of the new view (https://docs.slack.dev/surfaces/modals).
 *
 * Scoping the block_id to the project therefore forces Slack to rebuild the
 * select whenever the project changes, so the displayed previous release tag
 * always belongs to the selected project. Within a single project the id stays
 * stable, which is what lets the user pick another tag.
 */
export function buildPreviousReleaseTagBlockId(projectId: number): string {
  return `${PREVIOUS_RELEASE_TAG_BLOCK_ID_PREFIX}-${projectId}`;
}

export function getSelectedPreviousReleaseTagName(
  values: Record<string, any> | undefined,
  projectId: number | undefined,
): string | undefined {
  if (
    values === undefined ||
    projectId === undefined ||
    Number.isNaN(projectId)
  ) {
    return undefined;
  }

  return values[buildPreviousReleaseTagBlockId(projectId)]?.[
    SELECT_PREVIOUS_RELEASE_TAG_ACTION_ID
  ]?.selected_option?.value;
}
