import type { Response } from 'express';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { getProjectsByChannelId } from '@/core/services/data';
import { logger } from '@/core/services/logger';
import { ProviderFactory } from '@/core/services/providers/ProviderFactory';
import { slackBotWebClient } from '@/core/services/slack';
import { getProjectIdValue } from '@/core/typings/Data';
import type { GitlabProjectDetails } from '@/core/typings/GitlabProject';
import type {
  SlackExpressRequest,
  SlackSlashCommandResponse,
} from '@/core/typings/SlackSlashCommand';
import { buildProjectListEphemeral } from './buildProjectListEphemeral';

const MAX_PROJECTS_BY_MESSAGE = 20;

export async function listProjectsRequestHandler(
  req: SlackExpressRequest,
  res: Response,
) {
  res.sendStatus(HTTP_STATUS_NO_CONTENT);

  const { channel_id, user_id } = req.body as SlackSlashCommandResponse;
  const dataProjects = await getProjectsByChannelId(channel_id);
  const projects: GitlabProjectDetails[] = (
    await Promise.all(
      dataProjects.map(async (dataProject) => {
        const projectId = getProjectIdValue(dataProject);
        try {
          const provider = ProviderFactory.getProviderForProject(projectId);
          const project = await provider.fetchProject(projectId);
          // Convert UnifiedProject to GitlabProjectDetails format
          return {
            id: typeof project.id === 'number' ? project.id : 0,
            name: project.name,
            path: project.path,
            path_with_namespace: project.pathWithNamespace,
            web_url: project.webUrl,
            default_branch: project.defaultBranch,
          } as GitlabProjectDetails;
        } catch (error) {
          logger.error(error, `Failed to fetch project ${projectId}:`);
          return null;
        }
      }),
    )
  )
    .filter((project): project is GitlabProjectDetails => project !== null)
    .sort((a, b) => a.path_with_namespace.localeCompare(b.path_with_namespace));

  const projectsParts: GitlabProjectDetails[][] = [];

  do {
    projectsParts.push(projects.splice(0, MAX_PROJECTS_BY_MESSAGE));
  } while (projects.length > 0);

  for (const projectsPart of projectsParts) {
    await slackBotWebClient.chat.postEphemeral(
      buildProjectListEphemeral({
        channelId: channel_id,
        displayTitle: projectsParts.indexOf(projectsPart) === 0,
        projects: projectsPart,
        userId: user_id,
      }),
    );
  }
}
