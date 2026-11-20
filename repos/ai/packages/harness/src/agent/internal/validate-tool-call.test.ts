import { tool } from '@ai-sdk/provider-utils';
import type { TextStreamPart, ToolSet } from 'ai';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { validateToolCall } from './run-prompt';

const bashTool = tool({
  description: 'Run a shell command',
  inputSchema: z.object({ command: z.string() }),
});

const tools = { bash: bashTool } as const satisfies ToolSet;

type ToolCall = Extract<TextStreamPart<typeof tools>, { type: 'tool-call' }>;

describe('validateToolCall', () => {
  it('parses a valid tool-call input against the merged tool schema', async () => {
    const result = await validateToolCall<typeof tools>({
      event: {
        type: 'tool-call',
        toolCallId: 'c1',
        toolName: 'bash',
        input: '{"command":"ls"}',
        nativeName: 'Bash',
        providerExecuted: true,
      },
      tools,
    });

    expect(result).toMatchObject({
      type: 'tool-call',
      toolCallId: 'c1',
      toolName: 'bash',
      input: { command: 'ls' },
      providerExecuted: true,
    });
    expect(
      (result as ToolCall & { invalid?: boolean }).invalid,
    ).toBeUndefined();
  });

  it('marks the part invalid when the input fails the schema', async () => {
    const result = await validateToolCall<typeof tools>({
      event: {
        type: 'tool-call',
        toolCallId: 'c2',
        toolName: 'bash',
        input: '{"foo":"bar"}',
        nativeName: 'Bash',
        providerExecuted: true,
      },
      tools,
    });

    expect(result).toMatchObject({
      type: 'tool-call',
      toolCallId: 'c2',
      toolName: 'bash',
      invalid: true,
    });
    // raw parsed JSON preserved on the invalid path
    expect((result as ToolCall & { input: unknown }).input).toEqual({
      foo: 'bar',
    });
  });

  it('marks the part invalid and dynamic when the tool is not declared', async () => {
    const result = await validateToolCall<typeof tools>({
      event: {
        type: 'tool-call',
        toolCallId: 'c3',
        toolName: 'unknown',
        input: '{"x":1}',
      },
      tools,
    });

    expect(result).toMatchObject({
      type: 'tool-call',
      toolCallId: 'c3',
      toolName: 'unknown',
      invalid: true,
      dynamic: true,
    });
    expect((result as ToolCall & { error?: Error }).error).toBeInstanceOf(
      Error,
    );
  });

  it('omits providerExecuted when the bridge did not set it', async () => {
    const result = await validateToolCall<typeof tools>({
      event: {
        type: 'tool-call',
        toolCallId: 'c4',
        toolName: 'bash',
        input: '{"command":"ls"}',
      },
      tools,
    });
    expect(
      (result as ToolCall & { providerExecuted?: boolean }).providerExecuted,
    ).toBeUndefined();
  });

  it('treats an empty input string as an empty object before validating', async () => {
    const noArgsTool = {
      empty: tool({
        description: 'No args',
        inputSchema: z.object({}),
      }),
    } as const satisfies ToolSet;

    const result = await validateToolCall<typeof noArgsTool>({
      event: {
        type: 'tool-call',
        toolCallId: 'c5',
        toolName: 'empty',
        input: '',
        providerExecuted: true,
      },
      tools: noArgsTool,
    });
    expect(result).toMatchObject({
      type: 'tool-call',
      toolCallId: 'c5',
      toolName: 'empty',
      input: {},
    });
  });
});
