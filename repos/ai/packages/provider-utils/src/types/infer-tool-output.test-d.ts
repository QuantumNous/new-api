import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import type { InferToolOutput } from './infer-tool-output';
import { tool } from './tool';

describe('InferToolOutput', () => {
  it('infers the output type from a tool with execute function', () => {
    const weatherTool = tool({
      inputSchema: z.object({
        city: z.string(),
      }),
      execute: async () => ({
        temperature: 72,
        conditions: 'sunny' as const,
      }),
    });

    expectTypeOf<InferToolOutput<typeof weatherTool>>().toEqualTypeOf<{
      temperature: number;
      conditions: 'sunny';
    }>();
  });

  it('infers the output type from a tool with outputSchema', () => {
    const weatherTool = tool({
      inputSchema: z.object({
        city: z.string(),
      }),
      outputSchema: z.object({
        temperature: z.number(),
        conditions: z.literal('sunny'),
      }),
    });

    expectTypeOf<InferToolOutput<typeof weatherTool>>().toEqualTypeOf<{
      temperature: number;
      conditions: 'sunny';
    }>();
  });
});
