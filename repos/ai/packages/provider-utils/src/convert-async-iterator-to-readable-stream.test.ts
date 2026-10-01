import { convertAsyncIteratorToReadableStream } from './convert-async-iterator-to-readable-stream';
import { describe, expect, it } from 'vitest';

async function* makeGenerator(onFinally: () => void) {
  try {
    let i = 0;
    while (true) {
      await Promise.resolve();
      yield i++;
    }
  } finally {
    onFinally();
  }
}

describe('convertAsyncIteratorToReadableStream', () => {
  it('calls iterator.return() on cancel and triggers finally', async () => {
    let finallyCalled = false;
    const it = makeGenerator(() => {
      finallyCalled = true;
    });
    const stream = convertAsyncIteratorToReadableStream(it);
    const reader = stream.getReader();

    await reader.read();
    await reader.cancel('stop');

    // give microtasks a tick for finally to run
    await Promise.resolve();

    expect(finallyCalled).toBe(true);
  });

  it('does not enqueue further values after cancel', async () => {
    const it = makeGenerator(() => {});
    const stream = convertAsyncIteratorToReadableStream(it);
    const reader = stream.getReader();

    await reader.read();
    await reader.cancel('stop');

    const { done, value } = await reader.read();
    expect(done).toBe(true);
    expect(value).toBeUndefined();
  });

  it('works with iterator without return() method', async () => {
    const it: AsyncIterator<number> = {
      async next() {
        return { value: 42, done: false };
      },
    };
    const stream = convertAsyncIteratorToReadableStream(it);
    const reader = stream.getReader();

    const { value } = await reader.read();
    expect(value).toBe(42);

    await expect(reader.cancel()).resolves.toBeUndefined();
  });

  it('ignores errors from iterator.return()', async () => {
    const it: AsyncIterator<number> = {
      async next() {
        return { value: 1, done: false };
      },
      async return() {
        throw new Error('return() failed');
      },
    };
    const stream = convertAsyncIteratorToReadableStream(it);
    const reader = stream.getReader();

    await reader.read();
    await expect(reader.cancel()).resolves.toBeUndefined();
  });
});
