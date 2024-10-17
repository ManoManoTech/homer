import type { Response } from 'express';
import { Op } from 'sequelize';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { getReleases } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import type {
  SlackExpressRequest,
  SlackSlashCommandResponse,
} from '@/core/typings/SlackSlashCommand';
import ConfigHelper from '../../utils/ConfigHelper';
import { buildReleaseSelectionEphemeral } from '../../viewBuilders/buildReleaseSelectionEphemeral';

export async function endReleaseRequestHandler(
  req: SlackExpressRequest,
  res: Response
) {
  res.sendStatus(HTTP_STATUS_NO_CONTENT);

  const { channel_id: channelId, user_id: userId } =
    req.body as SlackSlashCommandResponse;

  const projectIds = (
    await ConfigHelper.getChannelProjectReleaseConfigs(channelId)
  ).map(({ projectId }) => projectId);

  const releases = await getReleases({
    projectId: { [Op.or]: projectIds },
    state: 'monitoring',
  });

  if (releases.length === 0) {
    await slackBotWebClient.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text: 'There is no release to end in this channel :homer-donut:',
    });
  } else {
    await slackBotWebClient.chat.postEphemeral(
      await buildReleaseSelectionEphemeral({
        action: 'end',
        channelId,
        releases,
        userId,
      })
    );
  }
}
