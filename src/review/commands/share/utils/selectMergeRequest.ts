import { addReviewToChannel } from '@/core/services/data';
import { ProviderFactory } from '@/core/services/providers/ProviderFactory';
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
  const [projectIdStr, mergeRequestIidStr] = extractActionParameters(
    action.selected_option.value
  );

  // URL decode the projectId in case Slack encoded the '/' character
  const decodedProjectIdStr = decodeURIComponent(projectIdStr);

  // Parse projectId - keep as string if it contains '/', otherwise parse as number
  const projectId: number | string = decodedProjectIdStr.includes('/')
    ? decodedProjectIdStr
    : parseInt(decodedProjectIdStr, 10);
  const mergeRequestIid = parseInt(mergeRequestIidStr, 10);

  const providerType = ProviderFactory.detectProviderType(projectId);

  await deleteEphemeralMessage(response_url);

  const { ts } = await slackBotWebClient.chat.postMessage(
    await buildReviewMessage(channel_id, projectId, mergeRequestIid)
  );

  await addReviewToChannel({
    channelId: channel_id,
    mergeRequestIid,
    projectId: typeof projectId === 'number' ? projectId : null,
    projectIdString: typeof projectId === 'string' ? projectId : null,
    providerType,
    ts: ts as string,
  });
}
