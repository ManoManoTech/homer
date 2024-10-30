import type { Block, KnownBlock, View } from '@slack/types';
import { generateChangelog } from '@/changelog/utils/generateChangelog';
import { slackifyChangelog } from '@/changelog/utils/slackifyChangelog';
import { getProjectsByChannelId } from '@/core/services/data';
import { fetchProjectById, fetchProjectTags } from '@/core/services/gitlab';
import { logger } from '@/core/services/logger';
import type { GitlabProjectDetails } from '@/core/typings/GitlabProject';
import type { SlackOption } from '@/core/typings/SlackOption';

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
            logger.warn(
              `Failed to fetch project ${dataProject.projectId}:`,
              error
            );
            return null;
          }
        })
      )
    ).filter((project): project is GitlabProjectDetails => project !== null);

    projectOptions = projects
      .sort((a, b) =>
        a.path_with_namespace.localeCompare(b.path_with_namespace)
      )
      .map((project) => ({
        text: {
          type: 'plain_text',
          text: project.path_with_namespace,
        },
        value: project.id.toString(),
      })) as SlackOption[];
  }

  if (!projectOptions || projectOptions.length === 0) {
    throw new Error(
      'No Gitlab project has been found on this channel :homer-stressed:'
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
        block_id: 'changelog-project-block',
        dispatch_action: true,
        element: {
          type: 'static_select',
          action_id: 'changelog-select-project-action',
          options: projectOptions,
          initial_option: projectOptions?.[0],
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
              block_id: 'changelog-release-tag-block',
              dispatch_action: true,
              element: {
                type: 'static_select',
                action_id: 'changelog-select-release-tag-action',
                initial_option: previousReleaseOptions[0],
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
              block_id: 'changelog-release-tag-info-block',
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
        block_id: 'changelog-preview-title-block',
        text: {
          type: 'mrkdwn',
          text: '*Preview*',
        },
      },
      {
        type: 'section',
        block_id: 'changelog-preview-block',
        text: {
          type: 'mrkdwn',
          text: changelog
            ? slackifyChangelog(changelog)
            : 'No change has been found.',
        },
      },
      changelog && {
        type: 'input',
        block_id: 'changelog-markdown-block',
        label: {
          type: 'plain_text',
          text: 'Markdown',
        },
        element: {
          type: 'plain_text_input',
          multiline: true,
          initial_value: changelog,
        },
      },
    ]
      .flat()
      .filter(Boolean) as (KnownBlock | Block)[],
  };
}
