import { startTransition, useLayoutEffect, useState } from 'react';
import { readStreamableValue } from './read-streamable-value';
import type { StreamableValue } from './streamable-value';
import { isStreamableValue } from './is-streamable-value';

function checkStreamableValue(value: unknown): value is StreamableValue {
  const hasSignature = isStreamableValue(value);

  if (!hasSignature && value !== undefined) {
    throw new Error(
      'Invalid value: this hook only accepts values created via `createStreamableValue`.',
    );
  }

  return hasSignature;
}

/**
 * `useStreamableValue` is a React hook that takes a streamable value created via the `createStreamableValue().value` API,
 * and returns the current value, error, and pending state.
 *
 * This is useful for consuming streamable values received from a component's props. For example:
 *
 * ```js
 * function MyComponent({ streamableValue }) {
 *   const [data, error, pending] = useStreamableValue(streamableValue);
 *
 *   if (pending) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return <div>Data: {data}</div>;
 * }
 * ```
 */
export function useStreamableValue<T = unknown, Error = unknown>(
  streamableValue?: StreamableValue<T>,
): [data: T | undefined, error: Error | undefined, pending: boolean] {
  const [curr, setCurr] = useState<T | undefined>(
    checkStreamableValue(streamableValue) ? streamableValue.curr : undefined,
  );
  const [error, setError] = useState<Error | undefined>(
    checkStreamableValue(streamableValue) ? streamableValue.error : undefined,
  );
  const [pending, setPending] = useState<boolean>(
    checkStreamableValue(streamableValue) ? !!streamableValue.next : false,
  );

  useLayoutEffect(() => {
    if (!checkStreamableValue(streamableValue)) return;

    let cancelled = false;

    const iterator = readStreamableValue(streamableValue);
    if (streamableValue.next) {
      startTransition(() => {
        if (cancelled) return;
        setPending(true);
      });
    }

    (async () => {
      try {
        for await (const value of iterator) {
          if (cancelled) return;
          startTransition(() => {
            if (cancelled) return;
            setCurr(value);
          });
        }
      } catch (e) {
        if (cancelled) return;
        startTransition(() => {
          if (cancelled) return;
          setError(e as Error);
        });
      } finally {
        if (cancelled) return;
        startTransition(() => {
          if (cancelled) return;
          setPending(false);
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [streamableValue]);

  return [curr, error, pending];
}
