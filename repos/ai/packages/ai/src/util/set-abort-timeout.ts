/**
 * Schedules a timeout that aborts the given controller with a `TimeoutError`
 * `DOMException`, matching the reason produced by `AbortSignal.timeout(ms)`.
 *
 * @param abortController - The controller to abort when the timeout elapses.
 * If undefined, no timeout is scheduled.
 * @param label - Human-readable label included in the error message
 * (e.g. "Step", "Chunk").
 * @param timeoutMs - Duration in milliseconds before the controller is aborted.
 * If undefined, no timeout is scheduled.
 * @returns The timeout id (suitable for passing to `clearTimeout`), or
 * `undefined` if no timeout was scheduled.
 */
export function setAbortTimeout({
  abortController,
  label,
  timeoutMs,
}: {
  abortController: AbortController | undefined;
  label: string;
  timeoutMs: number | undefined;
}): ReturnType<typeof setTimeout> | undefined {
  if (abortController == null || timeoutMs == null) {
    return undefined;
  }

  return setTimeout(
    () =>
      abortController.abort(
        new DOMException(
          `${label} timeout of ${timeoutMs}ms exceeded`,
          'TimeoutError',
        ),
      ),
    timeoutMs,
  );
}
