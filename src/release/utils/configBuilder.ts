import type { JSONSchemaType } from 'ajv';
import Ajv from 'ajv';
import { multipleProjectReleaseManager } from '../commands/create/managers/multipleProjectReleaseManager';
import type {
  ProjectConfigurationsJSON,
  ProjectReleaseConfig,
  ProjectConfigJSON,
  ReleaseManagerJSON,
  MultipleProjectReleaseManagerJSON,
} from '../typings/ProjectReleaseConfig';
import type { ReleaseManager } from '../typings/ReleaseManager';
import type { ReleaseTagManager } from '../typings/ReleaseTagManager';

// only one Ajv instance should be used across all the application
// maybe a singleton class would be better
const ajv = new Ajv();

const multipleProjectReleaseManagerSchema: JSONSchemaType<MultipleProjectReleaseManagerJSON> =
  {
    type: 'object',
    properties: {
      type: { type: 'string', const: 'multipleProjectReleaseManager' },
      config: {
        type: 'object',
        properties: {
          appNameDefault: { type: 'string' },
          appName: { type: 'string' },
          appNameOther: { type: 'string' },
        },
        required: ['appNameDefault', 'appName', 'appNameOther'],
        additionalProperties: false,
      },
    },
    required: ['type', 'config'],
    additionalProperties: false,
  } as const;

const releaseManagerSchema: JSONSchemaType<ReleaseManagerJSON> = {
  anyOf: [{ type: 'string' }, multipleProjectReleaseManagerSchema],
} as const;

const projectSchema: JSONSchemaType<ProjectConfigJSON> = {
  type: 'object',
  properties: {
    notificationChannelIds: { type: 'array', items: { type: 'string' } },
    projectId: { type: 'number' },
    releaseChannelId: { type: 'string' },
    releaseManager: releaseManagerSchema,
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
} as const;

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
} as const;

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
    const { releaseManager, releaseTagManager, ...projectInfo } = project;
    if (
      typeof releaseManager === 'string' &&
      releaseManager in releaseManagers
    ) {
      projects.push({
        ...projectInfo,
        releaseManager: releaseManagers[releaseManager],
        releaseTagManager: releaseTagManager
          ? releaseTagManagers[releaseTagManager]
          : undefined,
      });
    } else if (
      typeof releaseManager === 'object' &&
      releaseManager.type === 'multipleProjectReleaseManager'
    ) {
      projects.push({
        ...projectInfo,
        releaseManager: multipleProjectReleaseManager,
        releaseTagManager: releaseTagManager
          ? releaseTagManagers[releaseTagManager]
          : undefined,
      });
    }
  }
  return projects;
}
