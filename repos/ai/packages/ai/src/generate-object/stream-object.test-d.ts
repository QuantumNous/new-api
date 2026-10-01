import type { JSONValue } from '@ai-sdk/provider';
import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import type { AsyncIterableStream } from '../util/async-iterable-stream';
import type { FinishReason } from '../types';
import { streamObject } from './stream-object';

describe('streamObject', () => {
  it('should not accept timeout option', () => {
    streamObject({
      schema: z.object({ number: z.number() }),
      model: undefined!,
      prompt: 'test',
      // @ts-expect-error timeout is not supported for the deprecated streamObject API
      timeout: 5000,
    });
  });

  it('should have finishReason property with correct type', () => {
    const result = streamObject({
      schema: z.object({ number: z.number() }),
      model: undefined!,
      prompt: 'test',
    });

    expectTypeOf<typeof result.finishReason>().toEqualTypeOf<
      Promise<FinishReason>
    >();
  });

  it('should support enum types', async () => {
    const result = await streamObject({
      output: 'enum',
      enum: ['a', 'b', 'c'] as const,
      model: undefined!,
      prompt: 'test',
    });

    expectTypeOf<typeof result.object>().toEqualTypeOf<
      Promise<'a' | 'b' | 'c'>
    >;

    for await (const text of result.partialObjectStream) {
      expectTypeOf(text).toEqualTypeOf<string>();
    }
  });

  it('should support schema types', async () => {
    const result = streamObject({
      schema: z.object({ number: z.number() }),
      model: undefined!,
      prompt: 'test',
    });

    expectTypeOf<typeof result.object>().toEqualTypeOf<
      Promise<{ number: number }>
    >();
  });

  it('should support no-schema output mode', async () => {
    const result = streamObject({
      output: 'no-schema',
      model: undefined!,
      prompt: 'test',
    });

    expectTypeOf<typeof result.object>().toEqualTypeOf<Promise<JSONValue>>();
  });

  it('should support array output mode', async () => {
    const result = streamObject({
      output: 'array',
      schema: z.number(),
      model: undefined!,
      prompt: 'test',
    });

    expectTypeOf<typeof result.partialObjectStream>().toEqualTypeOf<
      AsyncIterableStream<number[]>
    >();
    expectTypeOf<typeof result.object>().toEqualTypeOf<Promise<number[]>>();
  });

  it('should support stable start callbacks', () => {
    streamObject({
      schema: z.object({ number: z.number() }),
      model: undefined!,
      prompt: 'test',
      onStart: event => {
        expectTypeOf(event.operationId).toEqualTypeOf<string>();
      },
      onStepStart: event => {
        expectTypeOf(event.stepNumber).toEqualTypeOf<0>();
      },
    });
  });
});
