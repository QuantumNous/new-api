import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { executeTool } from './execute-tool';
import type { ExecutableTool } from './executable-tool';
import { tool } from './tool';
import type { ToolExecutionOptions } from './tool-execute-function';
describe('executeTool', () => {
  // Guards against re-introducing a "this-binding guard" (e.g. destructuring
  // `execute` off the tool before calling it), which would break class-based
  // tools that rely on `this` in `execute`.
  // See https://github.com/vercel/ai/pull/15917#discussion_r3376474765
  it('preserves `this` for a class-based tool.execute', async () => {
    class CalculatorTool {
      readonly inputSchema = z.object({ a: z.number(), b: z.number() });
      private readonly prefix = 'calc';

      async execute(input: { a: number; b: number }) {
        // accesses `this.prefix`, requiring `this` to be bound to the tool
        // instance when `execute` is invoked.
        return { id: this.prefix, sum: input.a + input.b };
      }
    }

    const calculatorTool = new CalculatorTool();

    const results: Array<{
      type: 'preliminary' | 'final';
      output: { id: string; sum: number };
    }> = [];

    for await (const result of executeTool({
      tool: calculatorTool as ExecutableTool<typeof calculatorTool>,
      input: { a: 1, b: 2 },
      options: {
        toolCallId: 'tool-call-1',
        messages: [],
        context: undefined as never,
      },
    })) {
      results.push(result);
    }

    expect(results).toEqual([
      { type: 'final', output: { id: 'calc', sum: 3 } },
    ]);
  });

  it('yields a single final output for non-streaming tools', async () => {
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

    const results: Array<{
      type: 'preliminary' | 'final';
      output: { city: string; requestId: string };
    }> = [];

    for await (const result of executeTool({
      tool: weatherTool as ExecutableTool<typeof weatherTool>,
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

  it('yields streamed values as preliminary output and repeats the last one as final', async () => {
    const executionOptions: ToolExecutionOptions<{ requestId: string }> = {
      toolCallId: 'tool-call-2',
      messages: [],
      context: { requestId: 'req-2' },
    };

    const weatherTool = tool({
      inputSchema: z.object({
        city: z.string(),
      }),
      contextSchema: z.object({
        requestId: z.string(),
      }),
      execute: async function* (input, options) {
        yield `${input.city}:${options.context.requestId}:1`;
        yield `${input.city}:${options.context.requestId}:2`;
      },
    });

    const results: Array<{ type: 'preliminary' | 'final'; output: string }> =
      [];

    for await (const result of executeTool({
      tool: weatherTool as ExecutableTool<typeof weatherTool>,
      input: { city: 'Berlin' },
      options: executionOptions,
    })) {
      results.push(result);
    }

    expect(results).toEqual([
      { type: 'preliminary', output: 'Berlin:req-2:1' },
      { type: 'preliminary', output: 'Berlin:req-2:2' },
      { type: 'final', output: 'Berlin:req-2:2' },
    ]);
  });
});
