import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { executeTool } from './execute-tool';
import type { ExecutableTool } from './executable-tool';
import { tool } from './tool';

describe('executeTool', () => {
  it('infers the generator output type for non-streaming tools', () => {
    const weatherTool = tool({
      inputSchema: z.object({
        city: z.string(),
      }),
      contextSchema: z.object({
        requestId: z.string(),
      }),
      execute: async (input, options) => {
        expectTypeOf(input).toEqualTypeOf<{ city: string }>();
        expectTypeOf(options.context).toEqualTypeOf<{ requestId: string }>();

        return {
          city: input.city,
          requestId: options.context.requestId,
        };
      },
    });

    const result = executeTool({
      tool: weatherTool as ExecutableTool<typeof weatherTool>,
      input: { city: 'Berlin' },
      options: {
        toolCallId: 'tool-call-1',
        messages: [],
        context: { requestId: 'req-1' },
      },
    });

    expectTypeOf<typeof result>().toEqualTypeOf<
      AsyncGenerator<
        | {
            type: 'preliminary';
            output: { city: string; requestId: string };
          }
        | {
            type: 'final';
            output: { city: string; requestId: string };
          }
      >
    >();
  });

  it('infers streamed tool outputs from async generator execute functions', () => {
    const weatherTool = tool({
      inputSchema: z.object({
        city: z.string(),
      }),
      contextSchema: z.object({
        requestId: z.string(),
      }),
      execute: async function* (input, options) {
        expectTypeOf(input).toEqualTypeOf<{ city: string }>();
        expectTypeOf(options.context).toEqualTypeOf<{ requestId: string }>();

        yield {
          city: input.city,
          requestId: options.context.requestId,
          step: 1 as const,
        };
      },
    });

    const result = executeTool({
      tool: weatherTool as ExecutableTool<typeof weatherTool>,
      input: { city: 'Berlin' },
      options: {
        toolCallId: 'tool-call-2',
        messages: [],
        context: { requestId: 'req-2' },
      },
    });

    expectTypeOf<typeof result>().toEqualTypeOf<
      AsyncGenerator<
        | {
            type: 'preliminary';
            output: {
              city: string;
              requestId: string;
              step: 1;
            };
          }
        | {
            type: 'final';
            output: {
              city: string;
              requestId: string;
              step: 1;
            };
          }
      >
    >();
  });
});
