/**
 * Runs the given chunk loaders once the browser is idle so lazily imported
 * modals are ready before the user opens them (S1 code splitting).
 *
 * Falls back to a short timeout when requestIdleCallback is unavailable
 * (e.g. jsdom). Returns a cleanup that cancels the pending callback.
 */
export function prefetchOnIdle(loaders: Array<() => Promise<unknown>>): () => void {
  if (typeof window === "undefined") return () => {};

  const schedule =
    typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback.bind(window)
      : (cb: () => void) => window.setTimeout(cb, 200);
  const cancel =
    typeof window.cancelIdleCallback === "function"
      ? window.cancelIdleCallback.bind(window)
      : (id: number) => window.clearTimeout(id);

  const handle = schedule(() => {
    for (const load of loaders) void load();
  });

  return () => cancel(handle);
}
