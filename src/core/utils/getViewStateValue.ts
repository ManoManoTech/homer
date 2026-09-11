export interface ViewStateValue {
  type?: string;
  value?: string | null;
  selected_option?: { value: string } | null;
  [key: string]: unknown;
}

interface ViewWithState {
  state?: { values?: Record<string, Record<string, ViewStateValue>> };
}

/**
 * Returns the state value of the element identified by `actionId`, whatever the
 * block it belongs to.
 *
 * Block ids of the modals are rotated on purpose, so that Slack rebuilds the
 * inputs instead of preserving their previous value. They cannot be relied on
 * to read the view state, whereas action ids are stable.
 */
export function getViewStateValue(
  view: ViewWithState | undefined,
  actionId: string,
): ViewStateValue | undefined {
  const values = view?.state?.values;

  if (values === undefined) {
    return undefined;
  }
  return Object.values(values).find(
    (blockValues) => blockValues?.[actionId] !== undefined,
  )?.[actionId];
}
