import type { DataRelease } from '@/core/typings/Data';
import { DEFAULT_PROVIDER, type ProviderType } from '@/core/typings/Provider';
import { federationReleaseTagManager } from '@/release/commands/create/managers/federationReleaseTagManager';
import { semanticReleaseTagManager } from '@/release/commands/create/managers/semanticReleaseTagManager';
import { stableDateReleaseTagManager } from '@/release/commands/create/managers/stableDateReleaseTagManager';
import type { ProjectReleaseConfig } from '@/release/typings/ProjectReleaseConfig';
import type { ReleaseTagManager } from '@/release/typings/ReleaseTagManager';
import { buildProjectReleaseConfigs } from '@/release/utils/configBuilder';
import projectsConfig from '@root/config/homer/projects.json';

const releaseTagManagers: Record<string, ReleaseTagManager> = {
  federationReleaseTagManager,
  semanticReleaseTagManager,
  stableDateReleaseTagManager,
};

export default class ConfigHelper {
  private static projectReleaseConfigs: ProjectReleaseConfig[];

  private static async init() {
    if (this.projectReleaseConfigs === undefined) {
      this.projectReleaseConfigs = await buildProjectReleaseConfigs(
        projectsConfig,
        releaseTagManagers,
      );
    }
  }

  static async getChannelProjectReleaseConfigs(
    channelId: string,
  ): Promise<ProjectReleaseConfig[]> {
    await this.init();
    return this.projectReleaseConfigs.filter(
      (config) => config.releaseChannelId === channelId,
    );
  }

  static async hasChannelReleaseConfigs(channelId: string): Promise<boolean> {
    return (await this.getChannelProjectReleaseConfigs(channelId)).length > 0;
  }

  static async getProjectReleaseConfig(
    projectId: number,
    provider: ProviderType = DEFAULT_PROVIDER,
  ): Promise<ProjectReleaseConfig> {
    await this.init();
    const projectReleaseConfig = this.projectReleaseConfigs.find((config) =>
      isConfigOf(config, projectId, provider),
    );

    if (projectReleaseConfig === undefined) {
      throw new Error(`Unable to find release config for project ${projectId}`);
    }
    return projectReleaseConfig;
  }

  static async hasProjectReleaseConfig(
    projectId: number,
    provider: ProviderType = DEFAULT_PROVIDER,
  ): Promise<boolean> {
    await this.init();
    const projectReleaseConfig = this.projectReleaseConfigs.find((config) =>
      isConfigOf(config, projectId, provider),
    );
    return projectReleaseConfig !== undefined;
  }
}

function isConfigOf(
  config: ProjectReleaseConfig,
  projectId: number,
  provider: ProviderType,
): boolean {
  return (
    config.projectId === projectId &&
    (config.provider ?? DEFAULT_PROVIDER) === provider
  );
}

/** GitLab and GitHub project ids can collide: the provider must match too. */
export function isChannelRelease(
  release: DataRelease,
  channelConfigs: ProjectReleaseConfig[],
): boolean {
  return channelConfigs.some((config) =>
    isConfigOf(config, release.projectId, release.provider ?? DEFAULT_PROVIDER),
  );
}
