import type {
  Block,
  InputBlock,
  KnownBlock,
  StaticSelect,
  View,
} from '@slack/web-api';
import { generateChangelog } from '@/changelog/utils/generateChangelog';
import {
  fetchProjectById,
  fetchProjectReleases,
  fetchProjectTags,
} from '@/core/services/gitlab';
import type { BlockActionView } from '@/core/typings/BlockActionPayload';
import type { SlackOption } from '@/core/typings/SlackOption';
import { slackifyText } from '@/core/utils/slackifyText';
import { truncateProjectPath } from '@/core/utils/truncateProjectPath';
import getReleaseOptions from '@/release/releaseOptions';
import ConfigHelper from '../../../utils/ConfigHelper';
import { buildPreviousReleaseTagOptionGroups } from '../utils/previousReleaseTagOptions';

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

  if (view !== undefined) {
    const { blocks, state } = view;

    previousReleaseTagName =
      state.values['release-previous-tag-block']?.[
        'release-select-previous-tag-action'
      ]?.selected_option?.value;

    projectId = parseInt(
      state.values['release-project-block']?.['release-select-project-action']
        ?.selected_option?.value,
      10,
    );

    projectOptions = ((blocks[0] as InputBlock).element as StaticSelect)
      .options as SlackOption[];
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

  const [tags, releases] = await Promise.all([
    fetchProjectTags(projectId),
    fetchProjectReleases(projectId),
  ]);

  const { optionGroups: previousReleaseOptionGroups, defaultOption } =
    buildPreviousReleaseTagOptionGroups(
      tags.filter(({ name }) => releaseTagManager.isReleaseTag(name)),
      releases,
    );

  const selectableTagNames = previousReleaseOptionGroups.flatMap(
    ({ options }) => options.map(({ value }) => value),
  );

  const previousReleaseTag =
    previousReleaseTagName !== undefined
      ? selectableTagNames.find((name) => name === previousReleaseTagName)
      : undefined;

  if (
    previousReleaseTagName !== undefined &&
    previousReleaseTag === undefined
  ) {
    throw new Error(`Previous release tag ${previousReleaseTagName} not found`);
  }

  if (previousReleaseTagName === undefined) {
    previousReleaseTagName = defaultOption?.value;
  }

  const changelog = previousReleaseTagName
    ? await generateChangelog(projectId, previousReleaseTagName)
    : '';

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
        block_id: 'release-project-block',
        dispatch_action: true,
        element: {
          type: 'static_select',
          action_id: 'release-select-project-action',
          initial_option:
            projectOptions.find(({ value }) => value === `${projectId}`) ??
            projectOptions[0],
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
        block_id: 'release-tag-block',
        element: {
          type: 'plain_text_input',
          action_id: 'release-tag-action',
          initial_value: releaseTagManager.createReleaseTag(
            previousReleaseTagName,
          ),
        },
        label: {
          type: 'plain_text',
          text: 'Release tag',
        },
      },
      previousReleaseOptionGroups.length > 0
        ? [
            {
              type: 'input',
              block_id: 'release-previous-tag-block',
              dispatch_action: true,
              element: {
                type: 'static_select',
                action_id: 'release-select-previous-tag-action',
                initial_option: defaultOption,
                option_groups: previousReleaseOptionGroups,
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
              block_id: 'release-previous-tag-info-block',
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
        block_id: 'release-changelog-block',
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
