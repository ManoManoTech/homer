import { addReviewToChannel } from '@/core/services/data';
import {
  deleteEphemeralMessage,
  slackBotWebClient,
} from '@/core/services/slack';
import type { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import type { StaticSelectAction } from '@/core/typings/StaticSelectAction';
import { extractActionParameters } from '@/core/utils/slackActions';
import { buildReviewMessage } from '../viewBuilders/buildReviewMessage';

export async function selectMergeRequest(
  payload: BlockActionsPayload,
  action: StaticSelectAction
) {
  const { container, response_url } = payload;
  const { channel_id } = container;
  const [projectId, mergeRequestIid] = extractActionParameters(
    action.selected_option.value
  ).map((value) => parseInt(value, 10));

  await deleteEphemeralMessage(response_url);

  const { ts } = await slackBotWebClient.chat.postMessage(
    await buildReviewMessage(channel_id, projectId, mergeRequestIid)
  );

  await addReviewToChannel({
    channelId: channel_id,
    mergeRequestIid,
    projectId,
    ts: ts as string,
  });
}
