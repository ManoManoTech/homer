import { Response } from 'express';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { fetchProjectById, searchProjects } from '@/core/services/gitlab';
import { slackBotWebClient } from '@/core/services/slack';
import { GitlabProject } from '@/core/typings/GitlabProject';
import {
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

  let projects: GitlabProject[] = [];

  if (!Number.isNaN(Number(query))) {
    try {
      projects = [await fetchProjectById(Number(query))];
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
        text: `No project match \`${query}\` :homer-stressed:`,
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
