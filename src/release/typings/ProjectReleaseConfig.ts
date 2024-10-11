import type { ReleaseManager } from './ReleaseManager';
import type { ReleaseTagManager } from './ReleaseTagManager';

export interface ProjectReleaseConfig {
  notificationChannelIds: string[];
  projectId: number;
  releaseChannelId: string;
  releaseManager: ReleaseManager;
  releaseTagManager?: ReleaseTagManager;
  hasReleasePipeline?: boolean;
}

interface ReleaseManagerConfig {
  appNameDefault?: string;
  appName?: string;
  appNameOther?: string;
}

export interface MultipleProjectReleaseManagerJSON {
  type: 'multipleProjectReleaseManager';
  config: Required<ReleaseManagerConfig>;
}

export type ReleaseManagerJSON = string | MultipleProjectReleaseManagerJSON;

export type ProjectConfigJSON = Omit<
  ProjectReleaseConfig,
  'releaseManager' | 'releaseTagManager'
> & {
  releaseManager: ReleaseManagerJSON;
  releaseTagManager?: string;
  description?: string;
};

export type ProjectConfigurationsJSON = {
  projects: Array<ProjectConfigJSON>;
};
