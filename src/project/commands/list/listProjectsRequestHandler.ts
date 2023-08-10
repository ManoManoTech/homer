import type { Response } from 'express';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { getProjectsByChannelId } from '@/core/services/data';
import { fetchProjectById } from '@/core/services/gitlab';
import { slackBotWebClient } from '@/core/services/slack';
import type { GitlabProjectDetails } from '@/core/typings/GitlabProject';
import type {
  SlackExpressRequest,
  SlackSlashCommandResponse,
} from '@/core/typings/SlackSlashCommand';
import { buildProjectListEphemeral } from './buildProjectListEphemeral';

const MAX_PROJECTS_BY_MESSAGE = 20;

export async function listProjectsRequestHandler(
  req: SlackExpressRequest,
  res: Response
) {
  res.sendStatus(HTTP_STATUS_NO_CONTENT);

  const { channel_id, user_id } = req.body as SlackSlashCommandResponse;
  const dataProjects = await getProjectsByChannelId(channel_id);
  const projects = (
    await Promise.all(
      dataProjects.map(async ({ projectId }) => fetchProjectById(projectId))
    )
  ).sort((a, b) => a.path_with_namespace.localeCompare(b.path_with_namespace));

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
      })
    );
  }
}
