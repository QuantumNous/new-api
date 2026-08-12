import React, { Suspense } from 'react';
import { createResolvablePromise } from '../util/create-resolvable-promise';

// Recursive type for the chunk.
type ChunkType =
  | {
      done: false;
      value: React.ReactNode;
      next: Promise<ChunkType>;
      append?: boolean;
    }
  | {
      done: true;
      value: React.ReactNode;
    };

// Use single letter names for the variables to reduce the size of the RSC payload.
// `R` for `Row`, `c` for `current`, `n` for `next`.
// Note: Array construction is needed to access the name R.
const R = [
  (async ({
    c: current,
    n: next,
  }: {
    c: React.ReactNode;
    n: Promise<ChunkType>;
  }) => {
    const chunk = await next;

    if (chunk.done) {
      return chunk.value;
    }

    if (chunk.append) {
      return (
        <>
          {current}
          <Suspense fallback={chunk.value}>
            <R c={chunk.value} n={chunk.next} />
          </Suspense>
        </>
      );
    }

    return (
      <Suspense fallback={chunk.value}>
        <R c={chunk.value} n={chunk.next} />
      </Suspense>
    );
  }) as unknown as React.FC<{
    c: React.ReactNode;
    n: Promise<ChunkType>;
  }>,
][0];

/**
 * Creates a suspended chunk for React Server Components.
 *
 * This function generates a suspenseful React component that can be dynamically updated.
 * It's useful for streaming updates to the client in a React Server Components context.
 *
 * @param {React.ReactNode} initialValue - The initial value to render while the promise is pending.
 * @returns {Object} An object containing:
 *   - row: A React node that renders the suspenseful content.
 *   - resolve: A function to resolve the promise with a new value.
 *   - reject: A function to reject the promise with an error.
 */
export function createSuspendedChunk(initialValue: React.ReactNode): {
  row: React.ReactNode;
  resolve: (value: ChunkType) => void;
  reject: (error: unknown) => void;
} {
  const { promise, resolve, reject } = createResolvablePromise<ChunkType>();

  return {
    row: (
      <Suspense fallback={initialValue}>
        <R c={initialValue} n={promise} />
      </Suspense>
    ),
    resolve,
    reject,
  };
}
