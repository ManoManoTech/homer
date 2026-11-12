const queues = new Map<string, Promise<unknown>>();

/**
 * Runs `task` once every task queued before it with the same key has settled.
 *
 * The lock lives in this process: Homer instances behind the same webhook do
 * not see each other's tasks.
 */
export async function runExclusive<T>(
  key: string,
  task: () => Promise<T>,
): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(task);

  queues.set(key, current);
  try {
    return await current;
  } finally {
    // A later task replaced this one in the queue and will clean up instead.
    if (queues.get(key) === current) {
      queues.delete(key);
    }
  }
}

/** Resolves once every queued task has settled, for tests. */
export async function settleExclusiveTasks(): Promise<void> {
  while (queues.size > 0) {
    await Promise.allSettled([...queues.values()]);
  }
}
