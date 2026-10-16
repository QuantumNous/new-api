import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { executeTool } from './execute-tool';
import { isExecutableTool, type ExecutableTool } from './executable-tool';
import { tool } from './tool';

describe('isExecutableTool', () => {
  it('narrows tools with execute to ExecutableTool', () => {
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

    if (isExecutableTool(weatherTool)) {
      expectTypeOf(weatherTool).toMatchTypeOf<
        ExecutableTool<typeof weatherTool>
      >();
      expectTypeOf(weatherTool.execute).not.toEqualTypeOf<undefined>();

      const result = executeTool({
        tool: weatherTool,
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
    }
  });

  it('narrows executable tool unions that include undefined', () => {
    const weatherTool = tool({
      inputSchema: z.object({
        city: z.string(),
      }),
      execute: async () => 'sunny' as const,
    });

    const maybeWeatherTool: typeof weatherTool | undefined =
      Math.random() > 0.5 ? weatherTool : undefined;

    if (isExecutableTool(maybeWeatherTool)) {
      expectTypeOf(maybeWeatherTool).toMatchTypeOf<
        ExecutableTool<typeof weatherTool>
      >();
      expectTypeOf(maybeWeatherTool.execute).not.toEqualTypeOf<undefined>();
    }
  });

  it('preserves undefined execute for non-executable tools', () => {
    const weatherTool = tool({
      inputSchema: z.object({
        city: z.string(),
      }),
    });

    if (!isExecutableTool(weatherTool)) {
      expectTypeOf(weatherTool.execute).toEqualTypeOf<undefined>();
    }
  });
});
