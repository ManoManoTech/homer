import { defaultReleaseManager } from '@/release/commands/create/managers/defaultReleaseManager';
import { federationReleaseTagManager } from '@/release/commands/create/managers/federationReleaseTagManager';
import { libraryReleaseManager } from '@/release/commands/create/managers/libraryReleaseManager';
import { semanticReleaseTagManager } from '@/release/commands/create/managers/semanticReleaseTagManager';
import { stableDateReleaseTagManager } from '@/release/commands/create/managers/stableDateReleaseTagManager';
import type { ProjectReleaseConfig } from '@/release/typings/ProjectReleaseConfig';
import type { ReleaseManager } from '@/release/typings/ReleaseManager';
import type { ReleaseTagManager } from '@/release/typings/ReleaseTagManager';
import projectsConfig from './projects.json';

const releaseManagers: Record<string, ReleaseManager> = {
  defaultReleaseManager,
  libraryReleaseManager,
};
const releaseTagManagers: Record<string, ReleaseTagManager> = {
  federationReleaseTagManager,
  semanticReleaseTagManager,
  stableDateReleaseTagManager,
};

function buildProjectReleaseConfigs(): ProjectReleaseConfig[] {
  const projects = [];
  for (const project of projectsConfig.projects) {
    const {
      releaseManager,
      releaseTagManager,
      notificationChannelIds,
      projectId,
      releaseChannelId,
    } = project;
    if (
      releaseManager in releaseManagers &&
      releaseTagManager in releaseTagManagers
    ) {
      projects.push({
        notificationChannelIds,
        projectId,
        releaseChannelId,
        releaseManager: releaseManagers[releaseManager],
        releaseTagManager: releaseTagManagers[releaseTagManager],
      });
    }
  }
  return projects;
}

export const projectReleaseConfigs: ProjectReleaseConfig[] =
  buildProjectReleaseConfigs();
