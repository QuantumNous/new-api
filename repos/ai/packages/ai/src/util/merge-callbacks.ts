import type { Callback } from '../util/callback';

/**
 * Creates an async callback that invokes the provided callbacks in parallel.
 * Undefined callbacks are skipped, and thrown or rejected callback errors are
 * ignored.
 *
 * @param callbacks The callbacks to invoke for each event.
 * @returns A callback that forwards each event to all callbacks and waits for
 * them to settle.
 */
export function mergeCallbacks<EVENT>(
  ...callbacks: Array<Callback<EVENT> | undefined>
): Callback<EVENT> {
  return async (event: EVENT) => {
    await Promise.allSettled(
      callbacks.map(async callback => {
        await callback?.(event);
      }),
    );
  };
}
