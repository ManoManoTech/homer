import { Op } from 'sequelize';
import { generateChangelog } from '@/changelog/utils/generateChangelog';
import {
  cleanReleases,
  createRelease as createReleaseEntry,
  getProjectReleases,
} from '@/core/services/data';
import { fetchSlackUserFromId } from '@/core/services/slack';
import type { DataRelease } from '@/core/typings/Data';
import type { ModalViewSubmissionPayload } from '@/core/typings/ModalViewSubmissionPayload';
import { parseProjectRef } from '@/core/utils/projectRef';
import getReleaseOptions from '@/release/releaseOptions';
import ConfigHelper from '../../../utils/ConfigHelper';
import { waitForReadinessAndStartRelease } from './waitForReadinessAndStartRelease';

export async function createRelease(
  payload: ModalViewSubmissionPayload,
): Promise<void> {
  const { user, view } = payload;
  const { values } = view.state;

  const { projectId, provider } = parseProjectRef(
    values['release-project-block']['release-select-project-action']
      .selected_option.value,
  );

  const releaseTagName: string =
    values['release-tag-block']['release-tag-action'].value;

  const previousReleaseTagName: string | undefined =
    values['release-previous-tag-block']?.['release-select-previous-tag-action']
      ?.selected_option?.value;

  const { releaseManager } = await ConfigHelper.getProjectReleaseConfig(
    projectId,
    provider,
  );

  const [description, slackAuthor] = await Promise.all([
    generateChangelog(
      projectId,
      previousReleaseTagName,
      (commit) => releaseManager.filterChangelog?.(commit, view.state) ?? true,
      provider,
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
    provider,
    slackAuthor,
    startedDeployments: [],
    state: 'notYetReady',
    successfulDeployments: [],
    tagName: releaseTagName,
    ts: undefined,
  };

  // Clean previous release to prevent conflicts
  if (releaseManager.filterReleasesToClean) {
    const projectReleases = await getProjectReleases(projectId, provider);
    const tagNames = releaseManager
      .filterReleasesToClean(releaseData, projectReleases, getReleaseOptions())
      .map(({ tagName }) => tagName);

    if (tagNames.length > 0) {
      await cleanReleases({
        projectId,
        provider,
        tagName: { [Op.or]: tagNames },
      });
    }
  } else {
    await cleanReleases({ projectId, provider });
  }

  const release = await createReleaseEntry(releaseData);
  await waitForReadinessAndStartRelease(release);
}
