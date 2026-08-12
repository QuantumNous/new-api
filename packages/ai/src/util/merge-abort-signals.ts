import { filterNullable } from '@ai-sdk/provider-utils';

/**
 * Merges multiple abort sources into a single `AbortSignal`.
 * The returned signal will abort when any input signal aborts or when any
 * numeric timeout elapses, using the reason from the first source to abort.
 *
 * @param signals - Abort signals or timeout durations in milliseconds.
 * `null` and `undefined` values are ignored.
 * @returns An `AbortSignal` that aborts when any valid source aborts,
 * or `undefined` if no valid sources are provided.
 */
export function mergeAbortSignals(
  ...signals: (AbortSignal | null | undefined | number)[]
): AbortSignal | undefined {
  const validSignals = filterNullable(...signals).map(signal =>
    signal instanceof AbortSignal ? signal : AbortSignal.timeout(signal),
  );

  return validSignals.length === 0
    ? undefined
    : validSignals.length === 1
      ? validSignals[0]
      : AbortSignal.any(validSignals);
}
