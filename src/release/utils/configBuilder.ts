import type { JSONSchemaType } from 'ajv';
import Ajv from 'ajv';
import ReleasePluginManager from '@/core/pluginManager/ReleasePluginManager';
import { logger } from '@/core/services/logger';
import type {
  ProjectConfigurationsJSON,
  ProjectReleaseConfig,
  ProjectConfigJSON,
} from '../typings/ProjectReleaseConfig';
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
    ignoredNoteAuthorPattern: { type: 'string', nullable: true },
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

function compileIgnoredNoteAuthorPattern(
  projectId: number,
  pattern: string | undefined,
): RegExp | undefined {
  if (!pattern) {
    return undefined;
  }
  try {
    return new RegExp(pattern);
  } catch (error) {
    throw new Error(
      `Invalid ignoredNoteAuthorPattern for project ${projectId}: ${
        (error as Error).message
      }`,
    );
  }
}

export async function buildProjectReleaseConfigs(
  configs: ProjectConfigurationsJSON,
  releaseTagManagers: Record<string, ReleaseTagManager>,
) {
  if (!validateProjectReleaseConfig(configs)) {
    logger.error(
      { errors: validateProjectReleaseConfig.errors },
      'The config file validation failed',
    );
    throw new Error(
      'The config file should contain an array of valid project configurations',
    );
  }
  const projects: ProjectReleaseConfig[] = [];
  for (const project of configs.projects) {
    const {
      releaseManager,
      releaseTagManager,
      ignoredNoteAuthorPattern,
      ...ids
    } = project;
    if (ReleasePluginManager.getReleaseManager(releaseManager) === undefined) {
      await ReleasePluginManager.loadReleaseManagerPlugin(
        `@root/plugins/release/${releaseManager}`,
      );
    }
    projects.push({
      ...ids,
      releaseManager: ReleasePluginManager.getReleaseManager(releaseManager)!,
      releaseTagManager: releaseTagManager
        ? releaseTagManagers[releaseTagManager]
        : undefined,
      ignoredNoteAuthorRegex: compileIgnoredNoteAuthorPattern(
        ids.projectId,
        ignoredNoteAuthorPattern,
      ),
    });
  }
  return projects;
}
