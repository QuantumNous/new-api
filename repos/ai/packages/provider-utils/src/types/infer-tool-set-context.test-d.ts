import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import type { InferToolSetContext } from './infer-tool-set-context';
import { tool, type Tool } from './tool';

describe('InferToolSetContext', () => {
  it('maps tool names to required context types across a tool set', () => {
    const tools = {
      weather: tool({
        inputSchema: z.object({
          city: z.string(),
        }),
        contextSchema: z.object({
          userId: z.string(),
        }),
      }),
      forecast: tool({
        inputSchema: z.object({
          days: z.number(),
        }),
        contextSchema: z.object({
          role: z.string(),
        }),
      }),
    };

    expectTypeOf<InferToolSetContext<typeof tools>>().toEqualTypeOf<{
      weather: { userId: string };
      forecast: { role: string };
    }>();
  });

  it('infers a single tool context type from a tool set', () => {
    const tools = {
      weather: tool({
        inputSchema: z.object({
          city: z.string(),
        }),
        contextSchema: z.object({
          userId: z.string(),
          role: z.string(),
        }),
      }),
    };

    expectTypeOf<InferToolSetContext<typeof tools>>().toEqualTypeOf<{
      weather: {
        userId: string;
        role: string;
      };
    }>();
  });

  it('returns an empty object for tools without required context', () => {
    const tools = {
      weather: tool({
        inputSchema: z.object({
          city: z.string(),
        }),
      }),
    };

    expectTypeOf<InferToolSetContext<typeof tools>>().toEqualTypeOf<{}>();
  });

  it('omits tools without required context from the inferred map', () => {
    const tools = {
      weather: tool({
        inputSchema: z.object({
          city: z.string(),
        }),
        contextSchema: z.object({
          userId: z.string(),
        }),
      }),
      forecast: tool({
        inputSchema: z.object({
          days: z.number(),
        }),
      }),
    };

    expectTypeOf<InferToolSetContext<typeof tools>>().toEqualTypeOf<{
      weather: {
        userId: string;
      };
    }>();
  });

  it('keeps tools with optional-only context properties', () => {
    type Tools = {
      weather: Tool<
        { city: string },
        never,
        { userId?: string; role?: string }
      >;
    };

    expectTypeOf<InferToolSetContext<Tools>>().toEqualTypeOf<{
      weather: {
        userId?: string;
        role?: string;
      };
    }>();
  });

  it('makes tool entries optional when the context object is optional', () => {
    type Tools = {
      weather: Tool<{ city: string }, never, { userId: string } | undefined>;
    };

    expectTypeOf<InferToolSetContext<Tools>>().toEqualTypeOf<{
      weather?: { userId: string } | undefined;
    }>();
  });

  it('omits tools with empty context objects', () => {
    type Tools = {
      weather: Tool<{ city: string }, never, {}>;
    };

    expectTypeOf<InferToolSetContext<Tools>>().toEqualTypeOf<{}>();
  });
});
