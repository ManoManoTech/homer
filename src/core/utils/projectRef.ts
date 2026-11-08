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
    return { provider: DEFAULT_PROVIDER, projectId: parseInt(prefix, 10) };
  }
  if (prefix !== 'github') {
    throw new Error(`Unknown provider in project reference: ${value}`);
  }
  return { provider: 'github', projectId: parseInt(id, 10) };
}
