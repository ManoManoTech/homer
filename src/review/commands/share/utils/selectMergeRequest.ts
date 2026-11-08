import { addReviewToChannel } from '@/core/services/data';
import {
  deleteEphemeralMessage,
  slackBotWebClient,
} from '@/core/services/slack';
import type { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import type { StaticSelectAction } from '@/core/typings/StaticSelectAction';
import { parseProjectRef } from '@/core/utils/projectRef';
import { extractActionParameters } from '@/core/utils/slackActions';
import { buildReviewMessage } from '../viewBuilders/buildReviewMessage';

export async function selectMergeRequest(
  payload: BlockActionsPayload,
  action: StaticSelectAction,
) {
  const { container, response_url } = payload;
  const { channel_id } = container;
  const [projectRef, iid] = extractActionParameters(
    action.selected_option.value,
  );
  const { projectId, provider } = parseProjectRef(projectRef);
  const mergeRequestIid = parseInt(iid, 10);

  await deleteEphemeralMessage(response_url);

  const { ts } = await slackBotWebClient.chat.postMessage(
    await buildReviewMessage(channel_id, provider, projectId, mergeRequestIid),
  );

  await addReviewToChannel({
    channelId: channel_id,
    mergeRequestIid,
    projectId,
    provider,
    ts: ts as string,
  });
}
