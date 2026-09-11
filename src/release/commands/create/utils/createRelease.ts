import { Op } from 'sequelize';
import { generateChangelog } from '@/changelog/utils/generateChangelog';
import {
  cleanReleases,
  createRelease as createReleaseEntry,
  getProjectReleases,
} from '@/core/services/data';
import { fetchProjectTags } from '@/core/services/gitlab';
import { fetchSlackUserFromId } from '@/core/services/slack';
import type { DataRelease } from '@/core/typings/Data';
import type { ModalViewSubmissionPayload } from '@/core/typings/ModalViewSubmissionPayload';
import getReleaseOptions from '@/release/releaseOptions';
import type { ReleaseTagManager } from '@/release/typings/ReleaseTagManager';
import ConfigHelper from '../../../utils/ConfigHelper';
import { waitForReadinessAndStartRelease } from './waitForReadinessAndStartRelease';

export async function createRelease(
  payload: ModalViewSubmissionPayload,
): Promise<void> {
  const { user, view } = payload;
  const { values } = view.state;

  const projectId = parseInt(
    values['release-project-block']['release-select-project-action']
      .selected_option.value,
    10,
  );

  const releaseTagName: string =
    values['release-tag-block']['release-tag-action'].value;

  const { releaseManager, releaseTagManager } =
    await ConfigHelper.getProjectReleaseConfig(projectId);

  const previousReleaseTagName = await resolvePreviousReleaseTagName(
    projectId,
    values['release-previous-tag-block']?.['release-select-previous-tag-action']
      ?.selected_option.value,
    releaseTagManager,
  );

  const [description, slackAuthor] = await Promise.all([
    generateChangelog(
      projectId,
      previousReleaseTagName,
      (commit) => releaseManager.filterChangelog?.(commit, view.state) ?? true,
    ),
    fetchSlackUserFromId(user.id),
    getReleaseOptions(),
  ]);

  if (slackAuthor === undefined) {
    throw new Error(
      `Unable to retrieve Slack user of release creator using id ${user.id}`,
    );
  }

  const releaseData: DataRelease = {
    description,
    failedDeployments: [],
    projectId,
    slackAuthor,
    startedDeployments: [],
    state: 'notYetReady',
    successfulDeployments: [],
    tagName: releaseTagName,
    ts: undefined,
  };

  // Clean previous release to prevent conflicts
  if (releaseManager.filterReleasesToClean) {
    const projectReleases = await getProjectReleases(projectId);
    const tagNames = releaseManager
      .filterReleasesToClean(releaseData, projectReleases, getReleaseOptions())
      .map(({ tagName }) => tagName);

    if (tagNames.length > 0) {
      await cleanReleases({
        projectId,
        tagName: { [Op.or]: tagNames },
      });
    }
  } else {
    await cleanReleases({ projectId });
  }

  const release = await createReleaseEntry(releaseData);
  await waitForReadinessAndStartRelease(release);
}

/**
 * Slack keeps the value of a select whose block_id and action_id are unchanged
 * between two views.update calls. After the user switches project in the
 * modal, the submitted previous tag can still be the one of the project
 * displayed first, which does not exist in the selected project.
 */
async function resolvePreviousReleaseTagName(
  projectId: number,
  submittedTagName: string | undefined,
  releaseTagManager: ReleaseTagManager | undefined,
): Promise<string | undefined> {
  if (submittedTagName === undefined) {
    return undefined;
  }

  const tags = await fetchProjectTags(projectId);

  if (tags.some(({ name }) => name === submittedTagName)) {
    return submittedTagName;
  }
  return tags.find(({ name }) => releaseTagManager?.isReleaseTag(name) ?? true)
    ?.name;
}
