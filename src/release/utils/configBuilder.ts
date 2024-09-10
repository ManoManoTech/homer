import type { JSONSchemaType } from 'ajv';
import Ajv from 'ajv';
import type {
  ProjectConfigurationsJSON,
  ProjectReleaseConfig,
  ProjectConfigJSON,
} from '../typings/ProjectReleaseConfig';
import type { ReleaseManager } from '../typings/ReleaseManager';
import type { ReleaseTagManager } from '../typings/ReleaseTagManager';

// only one Ajv instance should be used across all the application
// maybe a singleton class would be better
const ajv = new Ajv();

const projectSchema: JSONSchemaType<ProjectConfigJSON> = {
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

const configsSchema: JSONSchemaType<ProjectConfigurationsJSON> = {
  type: 'object',
  properties: {
    projects: {
      type: 'array',
      items: projectSchema,
    },
  },
  required: ['projects'],
  additionalProperties: false,
};

const validateProjectReleaseConfig = ajv.compile(configsSchema);

export function buildProjectReleaseConfigs(
  configs: ProjectConfigurationsJSON,
  releaseManagers: Record<string, ReleaseManager>,
  releaseTagManagers: Record<string, ReleaseTagManager>
) {
  if (!validateProjectReleaseConfig(configs)) {
    throw new Error(
      'The config file should contain an array of valid project configurations'
    );
  }
  const projects: ProjectReleaseConfig[] = [];
  for (const project of configs.projects) {
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
  return projects;
}
