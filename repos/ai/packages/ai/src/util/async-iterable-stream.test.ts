import {
  convertArrayToReadableStream,
  convertAsyncIterableToArray,
  convertReadableStreamToArray,
} from '@ai-sdk/provider-utils/test';
import { createAsyncIterableStream } from './async-iterable-stream';
import { describe, it, expect } from 'vitest';

describe('createAsyncIterableStream()', () => {
  it('should read all chunks from a non-empty stream using async iteration', async () => {
    const source = convertArrayToReadableStream(['chunk1', 'chunk2', 'chunk3']);

    const asyncIterableStream = createAsyncIterableStream(source);

    expect(await convertAsyncIterableToArray(asyncIterableStream)).toEqual([
      'chunk1',
      'chunk2',
      'chunk3',
    ]);
  });

  it('should handle an empty stream gracefully', async () => {
    const source = convertArrayToReadableStream<string>([]);
    const asyncIterableStream = createAsyncIterableStream(source);

    expect(await convertAsyncIterableToArray(asyncIterableStream)).toEqual([]);
  });

  it('should maintain ReadableStream functionality', async () => {
    const source = convertArrayToReadableStream(['chunk1', 'chunk2', 'chunk3']);

    const asyncIterableStream = createAsyncIterableStream(source);

    expect(await convertReadableStreamToArray(asyncIterableStream)).toEqual([
      'chunk1',
      'chunk2',
      'chunk3',
    ]);
  });

  it('should cancel stream on early exit from for-await loop', async () => {
    await expectUndefinedUnhandledRejections(async () => {
      let streamCancelled = false;

      const source = new ReadableStream({
        start(controller) {
          controller.enqueue('chunk1');
          controller.enqueue('chunk2');
          controller.enqueue('chunk3');
        },
        cancel() {
          streamCancelled = true;
          return Promise.resolve();
        },
      });

      const asyncIterableStream = createAsyncIterableStream(source);
      const asyncIterator = asyncIterableStream[Symbol.asyncIterator]();

      const collected: string[] = [];
      while (true) {
        const { done, value } = await asyncIterator.next();
        if (done) break;

        collected.push(value);
        if (value === 'chunk2') {
          await asyncIterator.return?.();
          break;
        }
      }

      expect(collected).toEqual(['chunk1', 'chunk2']);
      expect(streamCancelled).toBe(true);
    });
  });

  it('should cancel stream when exception thrown inside for-await loop', async () => {
    await expectUndefinedUnhandledRejections(async () => {
      let streamCancelled = false;

      const source = new ReadableStream({
        start(controller) {
          controller.enqueue('chunk1');
          controller.enqueue('chunk2');
          controller.enqueue('chunk3');
        },
        cancel() {
          streamCancelled = true;
          return Promise.resolve();
        },
      });

      const asyncIterableStream = createAsyncIterableStream(source);
      const asyncIterator = asyncIterableStream[Symbol.asyncIterator]();

      const collected: string[] = [];
      await expect(async () => {
        while (true) {
          const { done, value } = await asyncIterator.next();
          if (done) break;

          collected.push(value);
          if (value === 'chunk2') {
            await asyncIterator.throw?.(new Error('Test error'));
          }
        }
      }).rejects.toThrow('Test error');

      expect(collected).toEqual(['chunk1', 'chunk2']);
      expect(streamCancelled).toBe(true);
    });
  });

  it('should not cancel stream when exception thrown inside for-await loop', async () => {
    let streamCancelled = false;

    const source = new ReadableStream({
      start(controller) {
        controller.enqueue('chunk1');
        controller.enqueue('chunk2');
        controller.enqueue('chunk3');
        controller.close();
      },
      cancel() {
        streamCancelled = true;
        return Promise.resolve();
      },
    });

    const asyncIterableStream = createAsyncIterableStream(source);

    expect(await convertAsyncIterableToArray(asyncIterableStream)).toEqual([
      'chunk1',
      'chunk2',
      'chunk3',
    ]);

    expect(streamCancelled).toBe(false);
  });

  it('should not allow iterating twice after breaking', async () => {
    const source = convertArrayToReadableStream(['chunk1', 'chunk2', 'chunk3']);

    const asyncIterableStream = createAsyncIterableStream(source);

    const collected: string[] = [];
    for await (const chunk of asyncIterableStream) {
      collected.push(chunk);
      if (chunk === 'chunk1') {
        break;
      }
    }

    expect(collected).toEqual(['chunk1']);

    for await (const chunk of asyncIterableStream) {
      collected.push(chunk);
    }

    expect(collected).toEqual(['chunk1']);
  });

  it('should propagate errors from source stream to async iterable', async () => {
    let controller: ReadableStreamDefaultController<string>;
    const source = new ReadableStream({
      start(ctrl) {
        controller = ctrl;
        controller.enqueue('chunk1');
        controller.enqueue('chunk2');
      },
    });

    const asyncIterableStream = createAsyncIterableStream(source);

    const collected: string[] = [];
    await expect(async () => {
      for await (const chunk of asyncIterableStream) {
        collected.push(chunk);
        if (chunk === 'chunk2') {
          controller.error(new Error('Stream error'));
        }
      }
    }).rejects.toThrow('Stream error');

    expect(collected).toEqual(['chunk1', 'chunk2']);
  });

  it('should stop async iterable when stream is cancelled', async () => {
    await expectUndefinedUnhandledRejections(async () => {
      let iterationCompleted = false;
      let errorCaught: Error | null = null;

      const source = convertArrayToReadableStream([
        'chunk1',
        'chunk2',
        'chunk3',
      ]);

      const asyncIterableStream = createAsyncIterableStream(source);
      const asyncIterator = asyncIterableStream[Symbol.asyncIterator]();

      try {
        await asyncIterator.next();
        await asyncIterableStream.cancel('Test cancellation');
        iterationCompleted = true;
      } catch (error) {
        errorCaught = error as Error;
      } finally {
        await asyncIterator.return?.().catch(() => {});
      }

      expect(iterationCompleted).toBe(false);
      expect(errorCaught).not.toBeNull();
    });
  });

  it('should not collect any chunks when iterating on already cancelled stream', async () => {
    const source = convertArrayToReadableStream(['chunk1', 'chunk2', 'chunk3']);

    const asyncIterableStream = createAsyncIterableStream(source);

    await asyncIterableStream.cancel();

    const collected: string[] = [];
    for await (const chunk of asyncIterableStream) {
      collected.push(chunk);
    }

    expect(collected).toEqual([]);
  });

  it('should not throw when return is called after the stream completed', async () => {
    const input = ['chunk1', 'chunk2', 'chunk3'];
    const source = convertArrayToReadableStream(input);

    const asyncIterableStream = createAsyncIterableStream(source);

    const asyncIterator = asyncIterableStream[Symbol.asyncIterator]();

    const output = await (async () => {
      const output: Array<string> = [];

      while (true) {
        const value = await asyncIterator.next();

        if (value.done) {
          break;
        }

        output.push(value.value);
      }

      return output;
    })();

    expect(output).toEqual(input);

    expect(await asyncIterator.return?.()).toEqual({
      done: true,
      value: undefined,
    });
  });
});

async function expectUndefinedUnhandledRejections(
  fn: () => Promise<void>,
): Promise<void> {
  const listeners = process.listeners('unhandledRejection');
  const reasons: unknown[] = [];

  process.removeAllListeners('unhandledRejection');
  process.on('unhandledRejection', reason => {
    reasons.push(reason);
  });

  try {
    await fn();
    await new Promise(resolve => setTimeout(resolve, 0));
  } finally {
    process.removeAllListeners('unhandledRejection');
    for (const listener of listeners) {
      process.on('unhandledRejection', listener);
    }
  }

  expect(reasons).toEqual(
    Array.from({ length: reasons.length }, () => undefined),
  );
  expect(reasons.length).toBeLessThanOrEqual(1);
}
