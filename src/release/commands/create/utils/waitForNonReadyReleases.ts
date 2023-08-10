import { getReleases } from '@/core/services/data';
import { waitForReadinessAndStartRelease } from '@/release/commands/create/utils/waitForReadinessAndStartRelease';

export async function waitForNonReadyReleases(): Promise<void> {
  const releases = await getReleases({ state: 'notYetReady' });

  await Promise.all(
    releases.map(async (release) =>
      waitForReadinessAndStartRelease(release, false)
    )
  );
}
