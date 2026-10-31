import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { executeTool } from './execute-tool';
import { isExecutableTool } from './executable-tool';
import { tool } from './tool';

describe('isExecutableTool', () => {
  it('returns true for tools with an execute function', () => {
    const weatherTool = tool({
      inputSchema: z.object({
        city: z.string(),
      }),
      execute: async () => 'sunny',
    });

    expect(isExecutableTool(weatherTool)).toBe(true);
  });

  it('returns false for tools without an execute function', () => {
    const weatherTool = tool({
      inputSchema: z.object({
        city: z.string(),
      }),
    });

    expect(isExecutableTool(weatherTool)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isExecutableTool(undefined)).toBe(false);
  });

  it('allows executable tools to be passed to executeTool after narrowing', async () => {
    const weatherTool = tool({
      inputSchema: z.object({
        city: z.string(),
      }),
      contextSchema: z.object({
        requestId: z.string(),
      }),
      execute: async (input, options) => ({
        city: input.city,
        requestId: options.context.requestId,
      }),
    });

    if (!isExecutableTool(weatherTool)) {
      throw new Error('Expected weatherTool to be executable');
    }

    const results: Array<{
      type: 'preliminary' | 'final';
      output: { city: string; requestId: string };
    }> = [];

    for await (const result of executeTool({
      tool: weatherTool,
      input: { city: 'Berlin' },
      options: {
        toolCallId: 'tool-call-1',
        messages: [],
        context: { requestId: 'req-1' },
      },
    })) {
      results.push(result);
    }

    expect(results).toEqual([
      {
        type: 'final',
        output: { city: 'Berlin', requestId: 'req-1' },
      },
    ]);
  });
});
