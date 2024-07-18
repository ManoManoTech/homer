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
