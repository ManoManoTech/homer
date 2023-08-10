import { projectReleaseConfigs } from '@root/config/homer/projectReleaseConfigs';
import type { ProjectReleaseConfig } from '../typings/ProjectReleaseConfig';

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
