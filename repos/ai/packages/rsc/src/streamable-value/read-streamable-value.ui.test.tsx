import { delay } from '@ai-sdk/provider-utils';
import { createStreamableValue } from './create-streamable-value';
import { readStreamableValue } from './read-streamable-value';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('readStreamableValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return an async iterable', () => {
    const streamable = createStreamableValue();
    const result = readStreamableValue(streamable.value);
    streamable.done();

    expect(result).toBeDefined();
    expect(result[Symbol.asyncIterator]).toBeDefined();
  });

  it('should support reading streamed values and errors', async () => {
    const streamable = createStreamableValue(1);

    const updatePromise = (async () => {
      await delay();
      streamable.update(2);
      await delay();
      streamable.update(3);
      await delay();
      streamable.error('This is an error');
    })();

    const readPromise = (async () => {
      const values = [];

      try {
        for await (const v of readStreamableValue(streamable.value)) {
          values.push(v);
        }
        expect.fail('should not be reached');
      } catch (e) {
        expect(e).toStrictEqual('This is an error');
      }

      expect(values).toStrictEqual([1, 2, 3]);
    })();

    await vi.runAllTimersAsync();
    await Promise.all([updatePromise, readPromise]);
  });

  it('should be able to read values asynchronously with different value types', async () => {
    const streamable = createStreamableValue({});

    const updatePromise = (async () => {
      await delay();
      streamable.update([1]);
      streamable.update(['2']);
      streamable.done({ 3: 3 });
    })();

    const values = [];
    const readPromise = (async () => {
      for await (const v of readStreamableValue(streamable.value)) {
        values.push(v);
      }
    })();

    await vi.runAllTimersAsync();
    await Promise.all([updatePromise, readPromise]);

    expect(values).toStrictEqual([{}, [1], ['2'], { '3': 3 }]);
  });

  it('should be able to replay errors', async () => {
    const streamable = createStreamableValue(0);

    const updatePromise = (async () => {
      await delay();
      streamable.update(1);
      streamable.update(2);
      streamable.error({ customErrorMessage: 'this is an error' });
    })();

    const readPromise = (async () => {
      const values = [];

      try {
        for await (const v of readStreamableValue(streamable.value)) {
          values.push(v);
        }

        expect.fail('should not be reached');
      } catch (e) {
        expect(e).toStrictEqual({
          customErrorMessage: 'this is an error',
        });
      }
      expect(values).toStrictEqual([0, 1, 2]);
    })();

    await vi.runAllTimersAsync();
    await Promise.all([updatePromise, readPromise]);
  });

  it('should be able to append strings as patch', async () => {
    const streamable = createStreamableValue();
    const value = streamable.value;

    streamable.update('hello');
    streamable.update('hello world');
    streamable.update('hello world!');
    streamable.update('new string');
    streamable.done('new string with patch!');

    const values = [];
    for await (const v of readStreamableValue(value)) {
      values.push(v);
    }

    expect(values).toStrictEqual([
      'hello',
      'hello world',
      'hello world!',
      'new string',
      'new string with patch!',
    ]);
  });

  it('should be able to call .append() to send patches', async () => {
    const streamable = createStreamableValue();
    const value = streamable.value;

    streamable.append('hello');
    streamable.append(' world');
    streamable.append('!');
    streamable.done();

    const values = [];
    for await (const v of readStreamableValue(value)) {
      values.push(v);
    }

    expect(values).toStrictEqual(['hello', 'hello world', 'hello world!']);
  });

  it('should be able to mix .update() and .append() with optimized payloads', async () => {
    const streamable = createStreamableValue('hello');
    const value = streamable.value;

    streamable.append(' world');
    streamable.update('hello world!!');
    streamable.update('some new');
    streamable.update('some new string');
    streamable.append(' with patch!');
    streamable.done();

    const values = [];
    for await (const v of readStreamableValue(value)) {
      values.push(v);
    }

    expect(values).toStrictEqual([
      'hello',
      'hello world',
      'hello world!!',
      'some new',
      'some new string',
      'some new string with patch!',
    ]);
  });

  it('should behave like .update() with .append() and .done()', async () => {
    const streamable = createStreamableValue('hello');
    const value = streamable.value;

    streamable.append(' world');
    streamable.done('fin');

    const values = [];
    for await (const v of readStreamableValue(value)) {
      values.push(v);
    }

    expect(values).toStrictEqual(['hello', 'hello world', 'fin']);
  });
});
