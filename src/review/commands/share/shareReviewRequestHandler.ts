import { Response } from 'express';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import {
  addReviewToChannel,
  getProjectsByChannelId,
} from '@/core/services/data';
import { searchMergeRequests } from '@/core/services/gitlab';
import { slackBotWebClient, slackWebClient } from '@/core/services/slack';
import {
  SlackExpressRequest,
  SlackSlashCommandResponse,
} from '@/core/typings/SlackSlashCommand';
import { buildHelpMessage } from '@/core/viewBuilders/buildHelpMessage';
import { buildMRSelectionEphemeral } from './viewBuilders/buildMRSelectionEphemeral';
import { buildReviewMessage } from './viewBuilders/buildReviewMessage';

export async function shareReviewRequestHandler(
  req: SlackExpressRequest,
  res: Response
) {
  const { text, channel_id, user_id } = req.body as SlackSlashCommandResponse;
  const query = text.split(' ').slice(1).join(' ');

  if (query.length === 0) {
    res.send(buildHelpMessage(channel_id));
    return;
  }

  res.sendStatus(HTTP_STATUS_NO_CONTENT);

  const projects = await getProjectsByChannelId(channel_id);
  const mergeRequests = await searchMergeRequests(query, projects);

  if (mergeRequests.length === 1) {
    const { iid, project_id } = mergeRequests[0];
    const { ts } = await slackWebClient.chat.postMessage(
      await buildReviewMessage(channel_id, project_id, iid)
    );

    await addReviewToChannel({
      channelId: channel_id,
      mergeRequestIid: iid,
      projectId: project_id,
      ts: ts as string,
    });
  } else if (mergeRequests.length === 0) {
    await slackBotWebClient.chat.postEphemeral({
      channel: channel_id,
      user: user_id,
      text: `No merge request match \`${query}\` :homer-stressed:`,
    });
  } else {
    await slackBotWebClient.chat.postEphemeral(
      buildMRSelectionEphemeral({
        channelId: channel_id,
        mergeRequests,
        query,
        userId: user_id,
      })
    );
  }
}
