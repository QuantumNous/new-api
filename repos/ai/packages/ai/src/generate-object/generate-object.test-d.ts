import { describe, expectTypeOf, it } from 'vitest';
import { generateObject } from './generate-object';
import { z } from 'zod/v4';
import type { JSONValue } from '@ai-sdk/provider';

describe('generateObject', () => {
  it('should not accept timeout option', async () => {
    generateObject({
      schema: z.object({ number: z.number() }),
      model: undefined!,
      messages: [],
      // @ts-expect-error timeout is not supported for the deprecated generateObject API
      timeout: 5000,
    });
  });

  it('should support enum types', async () => {
    const result = await generateObject({
      output: 'enum',
      enum: ['a', 'b', 'c'] as const,
      model: undefined!,
      messages: [],
    });

    expectTypeOf<typeof result.object>().toEqualTypeOf<'a' | 'b' | 'c'>;
  });

  it('should support schema types', async () => {
    const result = await generateObject({
      schema: z.object({ number: z.number() }),
      model: undefined!,
      messages: [],
    });

    expectTypeOf<typeof result.object>().toEqualTypeOf<{ number: number }>();
  });

  it('should support no-schema output mode', async () => {
    const result = await generateObject({
      output: 'no-schema',
      model: undefined!,
      messages: [],
    });

    expectTypeOf<typeof result.object>().toEqualTypeOf<JSONValue>();
  });

  it('should support array output mode', async () => {
    const result = await generateObject({
      output: 'array',
      schema: z.number(),
      model: undefined!,
      messages: [],
    });

    expectTypeOf<typeof result.object>().toEqualTypeOf<number[]>();
  });

  it('should support stable start callbacks', async () => {
    generateObject({
      schema: z.object({ number: z.number() }),
      model: undefined!,
      messages: [],
      onStart: event => {
        expectTypeOf(event.operationId).toEqualTypeOf<string>();
      },
      onStepStart: event => {
        expectTypeOf(event.stepNumber).toEqualTypeOf<0>();
      },
    });
  });
});
