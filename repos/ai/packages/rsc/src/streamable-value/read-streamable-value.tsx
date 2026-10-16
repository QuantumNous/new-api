import { isStreamableValue } from './is-streamable-value';
import type { StreamableValue } from './streamable-value';

/**
 * `readStreamableValue` takes a streamable value created via the `createStreamableValue().value` API,
 * and returns an async iterator.
 *
 * ```js
 * // Inside your AI action:
 *
 * async function action() {
 *   'use server'
 *   const streamable = createStreamableValue();
 *
 *   streamable.update(1);
 *   streamable.update(2);
 *   streamable.done(3);
 *   // ...
 *   return streamable.value;
 * }
 * ```
 *
 * And to read the value:
 *
 * ```js
 * const streamableValue = await action()
 * for await (const v of readStreamableValue(streamableValue)) {
 *   console.log(v)
 * }
 * ```
 *
 * This logs out 1, 2, 3 on console.
 */
export function readStreamableValue<T = unknown>(
  streamableValue: StreamableValue<T>,
): AsyncIterable<T | undefined> {
  if (!isStreamableValue(streamableValue)) {
    throw new Error(
      'Invalid value: this hook only accepts values created via `createStreamableValue`.',
    );
  }

  return {
    [Symbol.asyncIterator]() {
      let row: StreamableValue<T> | Promise<StreamableValue<T>> =
        streamableValue;
      let value = row.curr; // the current value
      let isDone = false;
      let isFirstIteration = true;

      return {
        async next() {
          // the iteration is done already, return the last value:
          if (isDone) return { value, done: true };

          // resolve the promise at the beginning of each iteration:
          row = await row;

          // throw error if any:
          if (row.error !== undefined) {
            throw row.error;
          }

          // if there is a value or a patch, use it:
          if ('curr' in row || row.diff) {
            if (row.diff) {
              // streamable patch (text only):
              if (row.diff[0] === 0) {
                if (typeof value !== 'string') {
                  throw new Error(
                    'Invalid patch: can only append to string types. This is a bug in the AI SDK.',
                  );
                }

                // casting required to remove T & string limitation
                (value as string) = value + row.diff[1];
              }
            } else {
              // replace the value (full new value)
              value = row.curr;
            }

            // The last emitted { done: true } won't be used as the value
            // by the for await...of syntax.
            if (!row.next) {
              isDone = true;
              return { value, done: false };
            }
          }

          // there are no further rows to iterate over:
          if (row.next === undefined) {
            return { value, done: true };
          }

          row = row.next;

          if (isFirstIteration) {
            isFirstIteration = false; // TODO should this be set for every return?

            if (value === undefined) {
              // This is the initial chunk and there isn't an initial value yet.
              // Let's skip this one.
              return this.next();
            }
          }

          return { value, done: false };
        },
      };
    },
  };
}
