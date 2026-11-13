/** Resolves with `promise`'s value, or `onTimeout` if it is slower than `ms` or rejects. Never rejects. */
export function raceTimeout<T, F>(promise: Promise<T>, ms: number, onTimeout: F): Promise<T | F> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<F>((resolve) => {
    timer = setTimeout(() => resolve(onTimeout), ms);
  });
  // The request may still finish in the background; its outcome is then ignored.
  const safe = promise.catch(() => onTimeout);
  return Promise.race([safe, timeout]).finally(() => clearTimeout(timer));
}
