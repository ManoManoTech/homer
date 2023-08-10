export async function waitFor(
  callback: () => unknown,
  timeoutMs = 1000,
  intervalMs = 10
): Promise<void> {
  let error: unknown;
  let interval: NodeJS.Timeout;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      clearInterval(interval);
      reject(
        new Error(
          `waitFor timeout reached after ${timeoutMs}ms: ${
            error instanceof Error ? error.stack : error
          }`
        )
      );
    }, timeoutMs);

    const check = async () => {
      try {
        await callback();
        clearInterval(interval);
        clearTimeout(timeout);
        resolve();
      } catch (e) {
        error = e;
      }
    };

    interval = setInterval(check, intervalMs);
    check();
  });
}
