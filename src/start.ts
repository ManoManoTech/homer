import {
  connectToDatabase,
  disconnectFromDatabase,
} from '@/core/services/data';
import { logger } from '@/core/services/logger';
import { waitForNonReadyReleases } from '@/release/commands/create/utils/waitForNonReadyReleases';
import { scheduleReviewReminders } from '@/review/commands/reminder/scheduleReviewReminders';
import { app } from './app';

const PORT = 3000;

export async function start(): Promise<() => Promise<void>> {
  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, async () => {
      try {
        await connectToDatabase();
      } catch (error) {
        reject(
          new Error(
            `Unable to connect to the database: ${
              (error as Error).stack ?? error
            }`,
          ),
        );
        return;
      }
      logger.info(`Homer started on port ${PORT}.`);
      waitForNonReadyReleases(); // Promise ignored on purpose
      const stopReviewReminders = scheduleReviewReminders();
      resolve(async () => {
        stopReviewReminders();
        await new Promise<void>((r) => {
          server.close(() => r());
        });
        await disconnectFromDatabase();
      });
    });
  });
}
