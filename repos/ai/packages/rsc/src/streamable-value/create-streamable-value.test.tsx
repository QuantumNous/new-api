import { delay } from '@ai-sdk/provider-utils';
import { convertArrayToReadableStream } from '@ai-sdk/provider-utils/test';
import { createStreamableValue } from './create-streamable-value';
import {
  STREAMABLE_VALUE_TYPE,
  type StreamableValue,
} from './streamable-value';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function getRawChunks(streamableValue: StreamableValue<any, any>) {
  const chunks = [];
  let currentValue = streamableValue;

  while (true) {
    const { next, ...otherFields } = currentValue;

    chunks.push(otherFields);

    if (!next) break;

    currentValue = await next;
  }

  return chunks;
}

describe('createStreamableValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return latest value', async () => {
    const streamableValue = createStreamableValue(1)
      .update(2)
      .update(3)
      .done(4);

    expect(streamableValue.value.curr).toStrictEqual(4);
  });

  it('should be able to stream any JSON values', async () => {
    const streamable = createStreamableValue();
    streamable.update({ v: 123 });

    expect(streamable.value.curr).toStrictEqual({ v: 123 });

    streamable.done();
  });

  it('should support .error()', async () => {
    const streamable = createStreamableValue();
    streamable.error('This is an error');

    expect(streamable.value).toStrictEqual({
      error: 'This is an error',
      type: STREAMABLE_VALUE_TYPE,
    });
  });

  it('should directly emit the final value when reading .value', async () => {
    const streamable = createStreamableValue('1');
    streamable.update('2');
    streamable.update('3');

    expect(streamable.value.curr).toStrictEqual('3');

    streamable.done('4');

    expect(streamable.value.curr).toStrictEqual('4');
  });

  it('should be able to append strings as patch', async () => {
    const streamable = createStreamableValue();
    const value = streamable.value;

    streamable.update('hello');
    streamable.update('hello world');
    streamable.update('hello world!');
    streamable.update('new string');
    streamable.done('new string with patch!');

    expect(await getRawChunks(value)).toStrictEqual([
      { curr: undefined, type: STREAMABLE_VALUE_TYPE },
      { curr: 'hello' },
      { diff: [0, ' world'] },
      { diff: [0, '!'] },
      { curr: 'new string' },
      { diff: [0, ' with patch!'] },
    ]);
  });

  it('should be able to call .append() to send patches', async () => {
    const streamable = createStreamableValue();
    const value = streamable.value;

    streamable.append('hello');
    streamable.append(' world');
    streamable.append('!');
    streamable.done();

    expect(await getRawChunks(value)).toStrictEqual([
      { curr: undefined, type: STREAMABLE_VALUE_TYPE },
      { curr: 'hello' },
      { diff: [0, ' world'] },
      { diff: [0, '!'] },
      {},
    ]);
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

    expect(await getRawChunks(value)).toStrictEqual([
      { curr: 'hello', type: STREAMABLE_VALUE_TYPE },
      { diff: [0, ' world'] },
      { diff: [0, '!!'] },
      { curr: 'some new' },
      { diff: [0, ' string'] },
      { diff: [0, ' with patch!'] },
      {},
    ]);
  });

  it('should behave like .update() with .append() and .done()', async () => {
    const streamable = createStreamableValue('hello');
    const value = streamable.value;

    streamable.append(' world');
    streamable.done('fin');

    expect(await getRawChunks(value)).toStrictEqual([
      { curr: 'hello', type: STREAMABLE_VALUE_TYPE },
      { diff: [0, ' world'] },
      { curr: 'fin' },
    ]);
  });

  it('should be able to accept readableStream as the source', async () => {
    const streamable = createStreamableValue(
      convertArrayToReadableStream(['hello', ' world', '!']),
    );
    const value = streamable.value;

    expect(await getRawChunks(value)).toStrictEqual([
      { curr: undefined, type: STREAMABLE_VALUE_TYPE },
      { curr: 'hello' },
      { diff: [0, ' world'] },
      { diff: [0, '!'] },
      {},
    ]);
  });

  it('should accept readableStream with JSON payloads', async () => {
    const streamable = createStreamableValue(
      convertArrayToReadableStream([{ v: 1 }, { v: 2 }, { v: 3 }]),
    );
    const value = streamable.value;

    expect(await getRawChunks(value)).toStrictEqual([
      { curr: undefined, type: STREAMABLE_VALUE_TYPE },
      { curr: { v: 1 } },
      { curr: { v: 2 } },
      { curr: { v: 3 } },
      {},
    ]);
  });

  it('should lock the streamable if from readableStream', async () => {
    const streamable = createStreamableValue(
      new ReadableStream({
        async start(controller) {
          await delay();
          controller.enqueue('hello');
          controller.close();
        },
      }),
    );

    expect(() => streamable.update('world')).toThrowErrorMatchingInlineSnapshot(
      '[Error: .update(): Value stream is locked and cannot be updated.]',
    );
  });
});
