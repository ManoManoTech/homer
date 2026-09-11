import type {
  Block,
  InputBlock,
  KnownBlock,
  StaticSelect,
  View,
} from '@slack/web-api';
import { generateChangelog } from '@/changelog/utils/generateChangelog';
import { fetchProjectById, fetchProjectTags } from '@/core/services/gitlab';
import { logger } from '@/core/services/logger';
import type { BlockActionView } from '@/core/typings/BlockActionPayload';
import type { SlackOption } from '@/core/typings/SlackOption';
import { getViewStateValue } from '@/core/utils/getViewStateValue';
import { slackifyText } from '@/core/utils/slackifyText';
import { truncateProjectPath } from '@/core/utils/truncateProjectPath';
import getReleaseOptions from '@/release/releaseOptions';
import ConfigHelper from '../../../utils/ConfigHelper';
import {
  buildPreviousReleaseTagBlockId,
  buildReleaseTagBlockId,
  RELEASE_CHANGELOG_BLOCK_ID,
  RELEASE_PREVIOUS_TAG_INFO_BLOCK_ID,
  RELEASE_PROJECT_BLOCK_ID,
  RELEASE_SELECT_PREVIOUS_TAG_ACTION_ID,
  RELEASE_SELECT_PROJECT_ACTION_ID,
  RELEASE_TAG_ACTION_ID,
} from './releaseModalBlockIds';

interface ReleaseModalData {
  channelId?: string;
  view?: BlockActionView;
}

export async function buildReleaseModalView({
  channelId,
  view,
}: ReleaseModalData): Promise<View> {
  let previousReleaseTagName: string | undefined;
  let projectId: number | undefined;
  let projectOptions: SlackOption[] | undefined;

  // ⚠️ Everything read from `view` must be read synchronously: the callers
  // start this build before mutating `view.blocks` to display the loader.
  if (view !== undefined) {
    const { blocks } = view;

    previousReleaseTagName = getViewStateValue(
      view,
      RELEASE_SELECT_PREVIOUS_TAG_ACTION_ID,
    )?.selected_option?.value;

    const selectedProjectId = getViewStateValue(
      view,
      RELEASE_SELECT_PROJECT_ACTION_ID,
    )?.selected_option?.value;

    projectId =
      selectedProjectId !== undefined
        ? parseInt(selectedProjectId, 10)
        : undefined;

    if (projectId !== undefined && Number.isNaN(projectId)) {
      projectId = undefined;
    }

    const projectBlock = blocks.find(
      (block) =>
        ((block as InputBlock).element as StaticSelect)?.action_id ===
        RELEASE_SELECT_PROJECT_ACTION_ID,
    ) as InputBlock | undefined;

    projectOptions = (projectBlock?.element as StaticSelect)?.options as
      | SlackOption[]
      | undefined;
  }

  if (projectOptions === undefined && channelId !== undefined) {
    const projectReleaseConfigs =
      await ConfigHelper.getChannelProjectReleaseConfigs(channelId);
    const projects = await Promise.all(
      projectReleaseConfigs.map(async (config) =>
        fetchProjectById(config.projectId),
      ),
    );

    projectOptions = projects
      .sort((a, b) =>
        a.path_with_namespace.localeCompare(b.path_with_namespace),
      )
      .map((project) => ({
        text: {
          type: 'plain_text',
          text: truncateProjectPath(project.path_with_namespace),
        },
        value: project.id.toString(),
      })) as SlackOption[];
  }

  if (!projectOptions || projectOptions.length === 0) {
    throw new Error(
      'No releasable Gitlab project has been found on this channel :homer-stressed:',
    );
  }

  if (projectId === undefined) {
    projectId = parseInt(projectOptions[0].value, 10);
  }

  const { releaseTagManager, releaseManager } =
    await ConfigHelper.getProjectReleaseConfig(projectId);

  if (releaseManager.buildReleaseModalView) {
    return releaseManager.buildReleaseModalView(
      {
        projectId,
        projectOptions,
        view,
      },
      getReleaseOptions(),
    );
  }

  if (releaseTagManager === undefined) {
    throw new Error(
      `The Gitlab project ${projectId} should either provide a release tag manager or a custom build modal method.`,
    );
  }

  const tags = (await fetchProjectTags(projectId))
    .filter(({ name }) => releaseTagManager.isReleaseTag(name))
    .slice(0, 5);

  const previousReleaseTag =
    previousReleaseTagName !== undefined
      ? tags.find(({ name }) => name === previousReleaseTagName)
      : undefined;

  if (
    previousReleaseTagName !== undefined &&
    previousReleaseTag === undefined
  ) {
    // Happens when a tag selected on another project is carried over. Throwing
    // here would leave the modal stuck on its loader, so fall back to the
    // latest release tag of the selected project instead.
    logger.error(
      new Error(
        `Previous release tag ${previousReleaseTagName} not found in project ${projectId}`,
      ),
    );
    previousReleaseTagName = undefined;
  }

  if (tags.length > 0 && previousReleaseTagName === undefined) {
    previousReleaseTagName = tags[0].name;
  }

  const changelog = previousReleaseTagName
    ? await generateChangelog(projectId, previousReleaseTagName)
    : '';

  const previousReleaseOptions = tags.map(({ name }) => ({
    text: {
      type: 'plain_text',
      text: name,
    },
    value: name,
  })) as SlackOption[];

  const projectInitialOption =
    projectOptions.find(({ value }) => value === `${projectId}`) ??
    projectOptions[0];

  const previousReleaseInitialOption =
    previousReleaseOptions.find(
      ({ value }) => value === previousReleaseTagName,
    ) ?? previousReleaseOptions[0];

  return {
    type: 'modal',
    callback_id: 'release-create-modal',
    title: {
      type: 'plain_text',
      text: 'Release',
    },
    submit: {
      type: 'plain_text',
      text: 'Start',
    },
    notify_on_close: false,
    blocks: [
      {
        type: 'input',
        block_id: RELEASE_PROJECT_BLOCK_ID,
        dispatch_action: true,
        element: {
          type: 'static_select',
          action_id: RELEASE_SELECT_PROJECT_ACTION_ID,
          initial_option: projectInitialOption,
          options: projectOptions,
          placeholder: {
            type: 'plain_text',
            text: 'Select the project',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Project',
        },
      },
      {
        type: 'input',
        block_id: buildReleaseTagBlockId(projectId, previousReleaseTagName),
        element: {
          type: 'plain_text_input',
          action_id: RELEASE_TAG_ACTION_ID,
          initial_value: releaseTagManager.createReleaseTag(
            previousReleaseTagName,
          ),
        },
        label: {
          type: 'plain_text',
          text: 'Release tag',
        },
      },
      previousReleaseOptions.length > 0
        ? [
            {
              type: 'input',
              block_id: buildPreviousReleaseTagBlockId(projectId),
              dispatch_action: true,
              element: {
                type: 'static_select',
                action_id: RELEASE_SELECT_PREVIOUS_TAG_ACTION_ID,
                initial_option: previousReleaseInitialOption,
                options: previousReleaseOptions,
                placeholder: {
                  type: 'plain_text',
                  text: 'Select the previous release tag',
                },
              },
              label: {
                type: 'plain_text',
                text: 'Previous release tag',
              },
            },
            {
              type: 'context',
              block_id: RELEASE_PREVIOUS_TAG_INFO_BLOCK_ID,
              elements: [
                {
                  type: 'plain_text',
                  text: 'This should be changed only whether the previous release has been aborted.',
                },
              ],
            },
          ]
        : [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Previous release tag*',
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'No previous release tag has been found.',
              },
            },
          ],
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Changelog*',
        },
      },
      {
        type: 'section',
        block_id: RELEASE_CHANGELOG_BLOCK_ID,
        text: {
          type: 'mrkdwn',
          text: changelog
            ? slackifyText(
                changelog,
                '*⚠️ Changelog truncated due to Slack limitations.*',
              )
            : 'No change has been found.',
        },
      },
    ]
      .flat()
      .filter(Boolean) as (KnownBlock | Block)[],
  };
}
