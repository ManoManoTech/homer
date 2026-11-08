import type { ProviderType } from '@/core/typings/Provider';
import { DEFAULT_PROVIDER } from '@/core/typings/Provider';

export interface ProjectRef {
  provider: ProviderType;
  projectId: number;
}

const PREFIX_SEPARATOR = ':';

/**
 * Serializes a project reference for Slack action values. GitLab projects keep
 * the bare id so values stay compatible with messages posted before GitHub
 * support.
 */
export function formatProjectRef({ provider, projectId }: ProjectRef): string {
  return provider === DEFAULT_PROVIDER
    ? `${projectId}`
    : `${provider}${PREFIX_SEPARATOR}${projectId}`;
}

export function parseProjectRef(value: string): ProjectRef {
  const [prefix, id] = value.split(PREFIX_SEPARATOR);

  if (id === undefined) {
    return { provider: DEFAULT_PROVIDER, projectId: parseId(prefix, value) };
  }
  if (prefix !== 'github') {
    throw new Error(`Unknown provider in project reference: ${value}`);
  }
  return { provider: 'github', projectId: parseId(id, value) };
}

function parseId(id: string, value: string): number {
  const projectId = Number(id);

  if (id === '' || !Number.isSafeInteger(projectId)) {
    throw new Error(`Invalid project reference: ${value}`);
  }
  return projectId;
}

/** Project reference of a release, which has no provider before GitHub. */
export function getReleaseProjectRef(release: {
  projectId: number;
  provider?: ProviderType;
}): ProjectRef {
  return {
    projectId: release.projectId,
    provider: release.provider ?? DEFAULT_PROVIDER,
  };
}
