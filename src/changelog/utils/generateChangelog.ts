import { getProvider } from '@/core/services/providers/ProviderFactory';
import type { GitlabCommit } from '@/core/typings/GitlabCommit';
import { DEFAULT_PROVIDER, type ProviderType } from '@/core/typings/Provider';

/**
 * Release plugins receive this function: `provider` comes last so existing
 * GitLab calls keep working.
 */
export async function generateChangelog(
  projectId: number,
  previousReleaseTagName: string | undefined,
  filter: (commit: GitlabCommit) => boolean = () => true,
  provider: ProviderType = DEFAULT_PROVIDER,
): Promise<string> {
  return getProvider(provider).generateChangelog(
    projectId,
    previousReleaseTagName,
    filter,
  );
}
