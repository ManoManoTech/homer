import { getReviewsByMergeRequestIid } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import type { ProviderType } from '@/core/typings/Provider';
import { StateUpdateDebouncer } from '../utils/StateUpdateDebouncer';
import { handleReviewWebhookError } from '../utils/handleReviewWebhookError';
import { buildNoteMessage, type Note } from '../viewBuilders/buildNoteMessage';
import { buildReviewMessage } from '../viewBuilders/buildReviewMessage';

export interface NoteEvent {
  provider: ProviderType;
  projectId: number;
  iid: number;
  note: Note;
}

// Prevents spam on threads when reviews are submitted, because providers send
// all the comment hooks at the same time.
const shockAbsorbers = new Map<string, StateUpdateDebouncer<Note[]>>();

export async function handleNoteEvent(
  { iid, note, projectId, provider }: NoteEvent,
  acknowledge: (handled: boolean) => void,
): Promise<void> {
  const reviews = await getReviewsByMergeRequestIid(projectId, iid, provider);

  if (reviews.length === 0) {
    acknowledge(false);
    return;
  }
  acknowledge(true);

  await Promise.all(
    reviews.map(async ({ channelId, ts }) => {
      const shockAbsorberId = `${channelId}_${ts}_${note.author_id}`;

      if (!shockAbsorbers.has(shockAbsorberId)) {
        shockAbsorbers.set(
          shockAbsorberId,
          new StateUpdateDebouncer<Note[]>([], (state) => {
            shockAbsorbers.delete(shockAbsorberId);
            return buildNoteMessage(provider, channelId, ts, state).then(
              slackBotWebClient.chat.postMessage,
            );
          }),
        );
      }

      const shockAbsorber = shockAbsorbers.get(shockAbsorberId)!;
      shockAbsorber.state = [...shockAbsorber.state, note];

      try {
        await Promise.all([
          buildReviewMessage(channelId, provider, projectId, iid, ts).then(
            slackBotWebClient.chat.update,
          ),
          shockAbsorber.promise,
        ]);
      } catch (err) {
        await handleReviewWebhookError(err, {
          hook: 'note',
          mrIid: iid,
          projectId,
          channelId,
          reviewTs: ts,
        });
      }
    }),
  );
}
