export type ProviderType = 'gitlab' | 'github';

export const DEFAULT_PROVIDER: ProviderType = 'gitlab';

/**
 * Values come from the database or from Slack action parameters, where the
 * provider is missing for data created before GitHub support.
 */
export function toProviderType(value: unknown): ProviderType {
  return value === 'github' ? 'github' : DEFAULT_PROVIDER;
}
