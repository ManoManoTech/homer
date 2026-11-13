import type { Response } from 'express';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { getProjectsByChannelId } from '@/core/services/data';
import { logger } from '@/core/services/logger';
import { getProvider } from '@/core/services/providers/ProviderFactory';
import { slackBotWebClient } from '@/core/services/slack';
import type {
  SlackExpressRequest,
  SlackSlashCommandResponse,
} from '@/core/typings/SlackSlashCommand';
import type { UnifiedProject } from '@/core/typings/UnifiedModels';
import { buildProjectListEphemeral } from './buildProjectListEphemeral';

const MAX_PROJECTS_BY_MESSAGE = 20;

export async function listProjectsRequestHandler(
  req: SlackExpressRequest,
  res: Response,
) {
  res.sendStatus(HTTP_STATUS_NO_CONTENT);

  const { channel_id, user_id } = req.body as SlackSlashCommandResponse;
  const dataProjects = await getProjectsByChannelId(channel_id);
  const projects: UnifiedProject[] = (
    await Promise.all(
      dataProjects.map(async ({ projectId, provider }) => {
        try {
          return await getProvider(provider).fetchProject(projectId);
        } catch (error) {
          logger.error(error, `Failed to fetch project ${projectId}:`);
          return null;
        }
      }),
    )
  )
    .filter((project): project is UnifiedProject => project !== null)
    .sort((a, b) => a.path.localeCompare(b.path));

  const projectsParts: UnifiedProject[][] = [];

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
