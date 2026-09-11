import type { Block, KnownBlock, View } from '@slack/types';
import { generateChangelog } from '@/changelog/utils/generateChangelog';
import { getProjectsByChannelId } from '@/core/services/data';
import { fetchProjectById, fetchProjectTags } from '@/core/services/gitlab';
import { logger } from '@/core/services/logger';
import type { GitlabProjectDetails } from '@/core/typings/GitlabProject';
import type { SlackOption } from '@/core/typings/SlackOption';
import { slackifyText } from '@/core/utils/slackifyText';
import { truncateProjectPath } from '@/core/utils/truncateProjectPath';
import {
  buildChangelogMarkdownBlockId,
  buildChangelogReleaseTagBlockId,
  CHANGELOG_MARKDOWN_ACTION_ID,
  CHANGELOG_PREVIEW_BLOCK_ID,
  CHANGELOG_PREVIEW_TITLE_BLOCK_ID,
  CHANGELOG_PROJECT_BLOCK_ID,
  CHANGELOG_RELEASE_TAG_INFO_BLOCK_ID,
  CHANGELOG_SELECT_PROJECT_ACTION_ID,
  CHANGELOG_SELECT_RELEASE_TAG_ACTION_ID,
} from './changelogModalBlockIds';

interface ChangelogModalData {
  channelId?: string;
  projectId?: number;
  projectOptions?: SlackOption[];
  releaseTagName?: string;
}

export async function buildChangelogModalView({
  channelId,
  projectId,
  projectOptions,
  releaseTagName,
}: ChangelogModalData): Promise<View> {
  if (channelId !== undefined && projectOptions === undefined) {
    const dataProjects = await getProjectsByChannelId(channelId);
    const projects: GitlabProjectDetails[] = (
      await Promise.all(
        dataProjects.map(async (dataProject) => {
          try {
            return await fetchProjectById(Number(dataProject.projectId));
          } catch (error) {
            logger.error(
              error,
              `Failed to fetch project ${dataProject.projectId}:`,
            );
            return null;
          }
        }),
      )
    ).filter((project): project is GitlabProjectDetails => project !== null);

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
      'No Gitlab project has been found on this channel :homer-stressed:',
    );
  }

  if (projectId === undefined) {
    projectId = parseInt(projectOptions[0].value, 10);
  }

  const tags = (await fetchProjectTags(projectId)).slice(0, 3);
  const previousReleaseTagName = releaseTagName ?? tags[0]?.name;
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
    callback_id: 'changelog-modal',
    title: {
      type: 'plain_text',
      text: 'Changelog',
    },
    submit: {
      type: 'plain_text',
      text: 'Ok',
    },
    notify_on_close: false,
    blocks: [
      {
        type: 'input',
        block_id: CHANGELOG_PROJECT_BLOCK_ID,
        dispatch_action: true,
        element: {
          type: 'static_select',
          action_id: CHANGELOG_SELECT_PROJECT_ACTION_ID,
          options: projectOptions,
          initial_option: projectInitialOption,
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
      previousReleaseOptions.length > 0
        ? [
            {
              type: 'input',
              block_id: buildChangelogReleaseTagBlockId(projectId),
              dispatch_action: true,
              element: {
                type: 'static_select',
                action_id: CHANGELOG_SELECT_RELEASE_TAG_ACTION_ID,
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
              block_id: CHANGELOG_RELEASE_TAG_INFO_BLOCK_ID,
              elements: [
                {
                  type: 'plain_text',
                  text: 'This should be changed only if the previous release has been aborted.',
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
        block_id: CHANGELOG_PREVIEW_TITLE_BLOCK_ID,
        text: {
          type: 'mrkdwn',
          text: '*Preview*',
        },
      },
      {
        type: 'section',
        block_id: CHANGELOG_PREVIEW_BLOCK_ID,
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
      changelog && {
        type: 'input',
        block_id: buildChangelogMarkdownBlockId(
          projectId,
          previousReleaseTagName,
        ),
        label: {
          type: 'plain_text',
          text: 'Markdown',
        },
        element: {
          type: 'plain_text_input',
          action_id: CHANGELOG_MARKDOWN_ACTION_ID,
          multiline: true,
          initial_value: changelog,
        },
      },
    ]
      .flat()
      .filter(Boolean) as (KnownBlock | Block)[],
  };
}
