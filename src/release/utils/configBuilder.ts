import type { JSONSchemaType } from 'ajv';
import Ajv from 'ajv';
import type {
  ProjectReleaseConfig,
  ProjectReleaseConfigJSON,
} from '../typings/ProjectReleaseConfig';
import type { ReleaseManager } from '../typings/ReleaseManager';
import type { ReleaseTagManager } from '../typings/ReleaseTagManager';

// only one instance should be used across all project
// maybe a singleton class would be better
const ajv = new Ajv();

const projectReleaseConfigSchema: JSONSchemaType<ProjectReleaseConfigJSON> = {
  type: 'object',
  properties: {
    notificationChannelIds: { type: 'array', items: { type: 'string' } },
    projectId: { type: 'number' },
    releaseChannelId: { type: 'string' },
    releaseManager: { type: 'string' },
    releaseTagManager: { type: 'string', nullable: true },
    description: { type: 'string', nullable: true },
    hasReleasePipeline: { type: 'boolean', nullable: true },
  },
  required: [
    'notificationChannelIds',
    'projectId',
    'releaseChannelId',
    'releaseManager',
  ],
  additionalProperties: false,
};

const validateProjectReleaseConfig = ajv.compile(projectReleaseConfigSchema);

export function buildProjectReleaseConfigs(
  configs: ProjectReleaseConfigJSON[],
  releaseManagers: Record<string, ReleaseManager>,
  releaseTagManagers: Record<string, ReleaseTagManager>
) {
  if (!Array.isArray(configs)) {
    return [];
  }
  const projects: ProjectReleaseConfig[] = [];
  for (const project of configs) {
    if (validateProjectReleaseConfig(project)) {
      const {
        releaseManager,
        releaseTagManager,
        notificationChannelIds,
        projectId,
        releaseChannelId,
      } = project;
      if (releaseManager in releaseManagers) {
        projects.push({
          notificationChannelIds,
          projectId,
          releaseChannelId,
          releaseManager: releaseManagers[releaseManager],
          releaseTagManager: releaseTagManager
            ? releaseTagManagers[releaseTagManager]
            : undefined,
        });
      }
    }
  }
  return projects;
}
