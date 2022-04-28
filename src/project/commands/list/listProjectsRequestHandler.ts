import { Response } from 'express';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { getProjectsByChannelId } from '@/core/services/data';
import { fetchProjectById } from '@/core/services/gitlab';
import { slackBotWebClient } from '@/core/services/slack';
import {
  SlackExpressRequest,
  SlackSlashCommandResponse,
} from '@/core/typings/SlackSlashCommand';
import { buildProjectListEphemeral } from './buildProjectListEphemeral';

export async function listProjectsRequestHandler(
  req: SlackExpressRequest,
  res: Response
) {
  res.sendStatus(HTTP_STATUS_NO_CONTENT);

  const { channel_id, user_id } = req.body as SlackSlashCommandResponse;
  const dataProjects = await getProjectsByChannelId(channel_id);
  const projects = await Promise.all(
    dataProjects.map(async ({ projectId }) =>
      fetchProjectById(Number(projectId))
    )
  );

  await slackBotWebClient.chat.postEphemeral(
    buildProjectListEphemeral({
      channelId: channel_id,
      projects,
      userId: user_id,
    })
  );
}
