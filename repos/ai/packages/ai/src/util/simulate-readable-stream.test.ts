import { simulateReadableStream } from './simulate-readable-stream';
import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import { beforeEach, describe, expect, it } from 'vitest';

describe('simulateReadableStream', () => {
  let delayValues: (number | null)[] = [];
  const mockDelay = (ms: number | null) => {
    delayValues.push(ms);
    return Promise.resolve();
  };

  beforeEach(() => {
    delayValues = [];
  });

  it('should create a readable stream with provided values', async () => {
    const values = ['a', 'b', 'c'];
    const stream = simulateReadableStream({ chunks: values });

    expect(await convertReadableStreamToArray(stream)).toEqual(values);
  });

  it('should respect the chunkDelayInMs setting', async () => {
    const stream = simulateReadableStream({
      chunks: [1, 2, 3],
      initialDelayInMs: 500,
      chunkDelayInMs: 100,
      _internal: { delay: mockDelay },
    });

    await convertReadableStreamToArray(stream); // consume stream

    expect(delayValues).toEqual([500, 100, 100]);
  });

  it('should handle empty values array', async () => {
    const stream = simulateReadableStream({ chunks: [] });
    const reader = stream.getReader();

    const { done, value } = await reader.read();

    expect(done).toBe(true);
    expect(value).toBeUndefined();
  });

  it('should handle different types of values', async () => {
    const stream = simulateReadableStream({
      chunks: [
        { id: 1, text: 'hello' },
        { id: 2, text: 'world' },
      ],
    });

    expect(await convertReadableStreamToArray(stream)).toEqual([
      { id: 1, text: 'hello' },
      { id: 2, text: 'world' },
    ]);
  });

  it('should skip all delays when both delay settings are null', async () => {
    const stream = simulateReadableStream({
      chunks: [1, 2, 3],
      initialDelayInMs: null,
      chunkDelayInMs: null,
      _internal: { delay: mockDelay },
    });

    await convertReadableStreamToArray(stream); // consume stream

    expect(delayValues).toEqual([null, null, null]);
  });

  it('should apply chunk delays but skip initial delay when initialDelayInMs is null', async () => {
    const stream = simulateReadableStream({
      chunks: [1, 2, 3],
      initialDelayInMs: null,
      chunkDelayInMs: 100,
      _internal: { delay: mockDelay },
    });

    await convertReadableStreamToArray(stream); // consume stream

    expect(delayValues).toEqual([null, 100, 100]);
  });

  it('should apply initial delay but skip chunk delays when chunkDelayInMs is null', async () => {
    const stream = simulateReadableStream({
      chunks: [1, 2, 3],
      initialDelayInMs: 500,
      chunkDelayInMs: null,
      _internal: { delay: mockDelay },
    });

    await convertReadableStreamToArray(stream); // consume stream

    expect(delayValues).toEqual([500, null, null]);
  });
});
