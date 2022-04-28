const SEPARATOR = '~~';

/**
 * Extracts the list of parameters from
 */
export function extractActionParameters(name: string): string[] {
  return name.split(SEPARATOR).slice(1);
}

/**
 * Creates a normalised Slack action name that can contains parameters.
 */
export function injectActionsParameters(
  name: string,
  ...parameters: any[]
): string {
  return [name, ...parameters].join(SEPARATOR);
}
