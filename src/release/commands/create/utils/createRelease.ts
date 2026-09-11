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
import { getViewStateValue } from '@/core/utils/getViewStateValue';
import getReleaseOptions from '@/release/releaseOptions';
import ConfigHelper from '../../../utils/ConfigHelper';
import {
  RELEASE_SELECT_PREVIOUS_TAG_ACTION_ID,
  RELEASE_SELECT_PROJECT_ACTION_ID,
  RELEASE_TAG_ACTION_ID,
} from '../viewBuilders/releaseModalBlockIds';
import { waitForReadinessAndStartRelease } from './waitForReadinessAndStartRelease';

export async function createRelease(
  payload: ModalViewSubmissionPayload,
): Promise<void> {
  const { user, view } = payload;

  const projectId = parseInt(
    getViewStateValue(view, RELEASE_SELECT_PROJECT_ACTION_ID)?.selected_option
      ?.value as string,
    10,
  );

  const releaseTagName = getViewStateValue(view, RELEASE_TAG_ACTION_ID)
    ?.value as string;

  const previousReleaseTagName: string | undefined = getViewStateValue(
    view,
    RELEASE_SELECT_PREVIOUS_TAG_ACTION_ID,
  )?.selected_option?.value;

  const { releaseManager } =
    await ConfigHelper.getProjectReleaseConfig(projectId);

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
