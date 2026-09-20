import { slackBotWebClient } from '@/core/services/slack';
import type { BlockActionView } from '@/core/typings/BlockActionPayload';

/**
 * Returns the hash of the view it leaves behind, which the caller passes to its
 * own final views.update so a rebuild overtaken by a concurrent interaction is
 * rejected rather than repainting the modal with outdated content.
 *
 * This optimistic concurrency is Slack-specific: another client (Mattermost…)
 * would need its own guard, as it has no equivalent of the view hash.
 */
export async function addLoaderToReleaseModal(
  view: BlockActionView,
): Promise<string | undefined> {
  const { blocks, callback_id, id, notify_on_close, submit, title, type } =
    view;
  const currentView = {
    blocks,
    callback_id,
    notify_on_close,
    submit,
    title,
    type,
  };

  view.blocks.push({
    type: 'section',
    text: {
      type: 'plain_text',
      text: ':loader:',
    },
  });

  const response = await slackBotWebClient.views.update({
    view_id: id,
    view: currentView,
  });

  return (response?.view as { hash?: string } | undefined)?.hash;
}
