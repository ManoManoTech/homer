import type { GitEvent } from '@/core/domain/GitEvent';
import type { GitProviderName } from '@/core/domain/RepoRef';

/**
 * An incoming webhook request, reduced to what recognising, authenticating and
 * reading it needs. `rawBody` holds the untouched request bytes, which a
 * signature has to be computed over.
 */
export interface WebhookRequest {
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  rawBody?: Buffer | string;
}

/**
 * Turns a provider's webhook request into a neutral event.
 */
export interface GitWebhookParser {
  readonly provider: GitProviderName;

  /** Whether this request comes from this provider, judged on its headers. */
  identify(request: WebhookRequest): boolean;

  /**
   * Whether the request is authentic: a shared secret compared in constant time
   * on GitLab, a signature of the raw body on GitHub.
   */
  verify(request: WebhookRequest): boolean;

  /**
   * The event the request describes, or `null` when it is one Homer ignores.
   */
  parse(request: WebhookRequest): GitEvent | null;
}
