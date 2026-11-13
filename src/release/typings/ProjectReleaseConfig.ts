import type { ReleaseManager } from './ReleaseManager';
import type { ReleaseTagManager } from './ReleaseTagManager';

export interface ProjectReleaseConfig {
  notificationChannelIds: string[];
  projectId: number;
  releaseChannelId: string;
  releaseManager: ReleaseManager;
  releaseTagManager?: ReleaseTagManager;
  hasReleasePipeline?: boolean;
  ignoredNoteAuthorRegex?: RegExp;
}

export type ProjectConfigJSON = Omit<
  ProjectReleaseConfig,
  'releaseManager' | 'releaseTagManager' | 'ignoredNoteAuthorRegex'
> & {
  releaseManager: string;
  releaseTagManager?: string;
  description?: string;
  ignoredNoteAuthorPattern?: string;
};

export type ProjectConfigurationsJSON = {
  projects: Array<ProjectConfigJSON>;
};
