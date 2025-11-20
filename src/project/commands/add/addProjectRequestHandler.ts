import type { Response } from 'express';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { searchProjects } from '@/core/services/gitlab';
import { logger } from '@/core/services/logger';
import { ProviderFactory } from '@/core/services/providers/ProviderFactory';
import { slackBotWebClient } from '@/core/services/slack';
import type { GitlabProject } from '@/core/typings/GitlabProject';
import type {
  SlackExpressRequest,
  SlackSlashCommandResponse,
} from '@/core/typings/SlackSlashCommand';
import { buildHelpMessage } from '@/core/viewBuilders/buildHelpMessage';
import { addProject } from './addProject';
import { buildAddProjectSelectionEphemeral } from './buildAddProjectSelectionEphemeral';

export async function addProjectRequestHandler(
  req: SlackExpressRequest,
  res: Response
) {
  const { text, channel_id, user_id } = req.body as SlackSlashCommandResponse;

  const query = text.split(' ').slice(2).join(' ');

  if (query.length === 0) {
    res.send(buildHelpMessage(channel_id));
    return;
  }

  res.sendStatus(HTTP_STATUS_NO_CONTENT);

  // Check if query is a GitHub project (owner/repo format)
  if (query.includes('/') && !query.includes('://')) {
    // GitHub project format
    logger.info({ query, channel_id, user_id }, 'Adding GitHub project');
    try {
      const provider = ProviderFactory.getProviderForProject(query);
      const project = await provider.fetchProject(query);
      logger.info({
        query,
        projectId: project.id,
        projectName: project.name,
      }, 'GitHub project fetched successfully');
      await addProject(query, channel_id, user_id, project.pathWithNamespace);
      logger.info({ query, channel_id }, 'GitHub project added successfully');
      return;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error({
        query,
        channel_id,
        error: errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
      }, 'Failed to add GitHub project');
      await slackBotWebClient.chat.postEphemeral({
        channel: channel_id,
        user: user_id,
        text: `Failed to add GitHub project \`${query}\` :homer-stressed:\n\nError: ${errorMessage}\n\nMake sure:\n- The format is \`owner/repo\` (e.g., \`facebook/react\`)\n- The repository exists and is accessible\n- GITHUB_TOKEN is properly configured`,
      });
      return;
    }
  }

  // GitLab project handling (numeric ID or text search)
  let projects: GitlabProject[] = [];

  if (!Number.isNaN(Number(query))) {
    try {
      const provider = ProviderFactory.getProviderForProject(Number(query));
      const project = await provider.fetchProject(Number(query));
      // Convert to GitLab format for compatibility
      projects = [
        {
          id: Number(query),
          path_with_namespace: project.pathWithNamespace,
        } as GitlabProject,
      ];
    } catch {
      await slackBotWebClient.chat.postEphemeral({
        channel: channel_id,
        user: user_id,
        text: `No project found with id \`${query}\` :homer-stressed:`,
      });
      return;
    }
  } else {
    projects = await searchProjects(query);

    if (projects.length === 0) {
      await slackBotWebClient.chat.postEphemeral({
        channel: channel_id,
        user: user_id,
        text: `No GitLab project matches \`${query}\` :homer-stressed:\n\nFor GitHub projects, use the format \`owner/repo\` (e.g., \`facebook/react\`)`,
      });
      return;
    }
    if (projects.length > 1) {
      await slackBotWebClient.chat.postEphemeral(
        buildAddProjectSelectionEphemeral({
          channelId: channel_id,
          projects,
          query,
          userId: user_id,
        })
      );
      return;
    }
  }

  const { id, path_with_namespace } = projects[0];
  await addProject(id, channel_id, user_id, path_with_namespace);
}
