import { defaultReleaseManager } from '@/release/commands/create/managers/defaultReleaseManager';
import { federationReleaseTagManager } from '@/release/commands/create/managers/federationReleaseTagManager';
import { libraryReleaseManager } from '@/release/commands/create/managers/libraryReleaseManager';
import { semanticReleaseTagManager } from '@/release/commands/create/managers/semanticReleaseTagManager';
import { stableDateReleaseTagManager } from '@/release/commands/create/managers/stableDateReleaseTagManager';
import type { ProjectReleaseConfig } from '@/release/typings/ProjectReleaseConfig';
import type { ReleaseManager } from '@/release/typings/ReleaseManager';
import type { ReleaseTagManager } from '@/release/typings/ReleaseTagManager';
import { buildProjectReleaseConfigs } from '@/release/utils/configBuilder';
import projectsConfig from '@root/config/homer/projects.json';

const releaseManagers: Record<string, ReleaseManager> = {
  defaultReleaseManager,
  libraryReleaseManager,
};
const releaseTagManagers: Record<string, ReleaseTagManager> = {
  federationReleaseTagManager,
  semanticReleaseTagManager,
  stableDateReleaseTagManager,
};

export const projectReleaseConfigs: ProjectReleaseConfig[] =
  buildProjectReleaseConfigs(
    projectsConfig.projects,
    releaseManagers,
    releaseTagManagers
  );

export function getChannelProjectReleaseConfigs(
  channelId: string
): ProjectReleaseConfig[] {
  return projectReleaseConfigs.filter(
    (config) => config.releaseChannelId === channelId
  );
}

export function getProjectReleaseConfig(
  projectId: number
): ProjectReleaseConfig {
  const projectReleaseConfig = projectReleaseConfigs.find(
    (config) => config.projectId === projectId
  );

  if (projectReleaseConfig === undefined) {
    throw new Error(`Unable to find release config for project ${projectId}`);
  }
  return projectReleaseConfig;
}

export function hasChannelReleaseConfigs(channelId: string): boolean {
  return getChannelProjectReleaseConfigs(channelId).length > 0;
}

export function hasProjectReleaseConfig(projectId: number): boolean {
  const projectReleaseConfig = projectReleaseConfigs.find(
    (config) => config.projectId === projectId
  );
  return projectReleaseConfig !== undefined;
}
