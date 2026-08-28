/**
 * Wraps a promise in a timeout race.
 * Rejects with a descriptive error and logs `[timeout] operation=<name> after=<ms>ms` if time limit is exceeded.
 */
export async function withTimeout<T>(
  promise: Promise<T> | PromiseLike<T>,
  ms: number = 10000,
  operationName: string = 'NetworkOperation'
): Promise<T> {
  let timer: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const msg = `[timeout] operation=${operationName} after=${ms}ms`;
      console.error(`🚨 ${msg}`);
      reject(new Error(msg));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
