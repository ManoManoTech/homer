import { MOES_TAVERN_CHANNEL_ID } from '@/constants';
import { defaultReleaseManager } from '@/release/commands/create/managers/defaultReleaseManager';
import { stableDateReleaseTagManager } from '@/release/commands/create/managers/stableDateReleaseTagManager';
import type { ProjectReleaseConfig } from '@/release/typings/ProjectReleaseConfig';

export const projectReleaseConfigs: ProjectReleaseConfig[] = [
  // tools/homer
  {
    notificationChannelIds: [MOES_TAVERN_CHANNEL_ID],
    projectId: 1148,
    releaseChannelId: MOES_TAVERN_CHANNEL_ID,
    releaseManager: defaultReleaseManager,
    releaseTagManager: stableDateReleaseTagManager,
  },
];
