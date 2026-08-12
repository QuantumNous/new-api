import { tool, type ModelMessage } from '@ai-sdk/provider-utils';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { TypeValidationError } from '../error';
import { resolveToolApproval } from './resolve-tool-approval';

describe('resolveToolApproval', () => {
  const messages = [{ role: 'user', content: 'hello' }] as const;
  const createToolCall = () => ({
    type: 'tool-call' as const,
    toolCallId: 'call-1',
    toolName: 'weather' as const,
    input: { city: 'Berlin' },
    dynamic: false as const,
  });

  it('returns not-applicable when neither user-defined nor tool-defined approval is configured', async () => {
    const result = await resolveToolApproval({
      tools: {
        weather: tool({
          inputSchema: z.object({ city: z.string() }),
        }),
      },
      toolApproval: undefined,
      toolCall: createToolCall(),
      messages: [...messages],
      toolsContext: {},
      runtimeContext: {},
    });

    expect(result).toEqual({ type: 'not-applicable' });
  });

  describe('GenericToolApprovalFunction (toolApproval as a function)', () => {
    it('invokes the generic function and normalizes a string status', async () => {
      const genericToolApproval = vi.fn(() => 'denied' as const);
      const toolDefinedNeedsApproval = vi.fn(() => true);

      const result = await resolveToolApproval({
        tools: {
          weather: tool({
            inputSchema: z.object({ city: z.string() }),
            needsApproval: toolDefinedNeedsApproval,
          }),
        },
        toolApproval: genericToolApproval,
        toolCall: createToolCall(),
        messages: [...messages],
        toolsContext: {},
        runtimeContext: {},
      });

      expect(result).toEqual({ type: 'denied' });
      expect(genericToolApproval).toHaveBeenCalledTimes(1);
      expect(toolDefinedNeedsApproval).not.toHaveBeenCalled();
    });

    it('passes toolCall, tools, toolsContext, messages, and runtimeContext to the generic function', async () => {
      const tools = {
        weather: tool({
          inputSchema: z.object({ city: z.string() }),
        }),
      } as const;
      const toolsContext = { weather: { requestId: 'req-1' } };
      const runtimeContext = { tenantId: 't-1' };
      const genericToolApproval = vi.fn(() => 'not-applicable' as const);

      await resolveToolApproval({
        tools,
        toolApproval: genericToolApproval,
        toolCall: createToolCall(),
        messages: [...messages],
        toolsContext,
        runtimeContext,
      });

      expect(genericToolApproval).toHaveBeenCalledWith({
        toolCall: createToolCall(),
        tools,
        toolsContext,
        messages: [...messages],
        runtimeContext,
      });
    });

    it('resolves a Promise returned by the generic function', async () => {
      const genericToolApproval = vi.fn(() =>
        Promise.resolve('user-approval' as const),
      );

      const result = await resolveToolApproval({
        tools: {
          weather: tool({
            inputSchema: z.object({ city: z.string() }),
          }),
        },
        toolApproval: genericToolApproval,
        toolCall: createToolCall(),
        messages: [...messages],
        toolsContext: {},
        runtimeContext: {},
      });

      expect(result).toEqual({ type: 'user-approval' });
    });

    it('treats undefined returned by the generic function as not-applicable', async () => {
      const genericToolApproval = vi.fn(() => undefined);

      const result = await resolveToolApproval({
        tools: {
          weather: tool({
            inputSchema: z.object({ city: z.string() }),
          }),
        },
        toolApproval: genericToolApproval,
        toolCall: createToolCall(),
        messages: [...messages],
        toolsContext: {},
        runtimeContext: {},
      });

      expect(result).toEqual({ type: 'not-applicable' });
    });

    it('treats Promise undefined returned by the generic function as not-applicable', async () => {
      const genericToolApproval = vi.fn(() => Promise.resolve(undefined));

      const result = await resolveToolApproval({
        tools: {
          weather: tool({
            inputSchema: z.object({ city: z.string() }),
          }),
        },
        toolApproval: genericToolApproval,
        toolCall: createToolCall(),
        messages: [...messages],
        toolsContext: {},
        runtimeContext: {},
      });

      expect(result).toEqual({ type: 'not-applicable' });
    });

    it('passes through an object status including reason from the generic function', async () => {
      const genericToolApproval = vi.fn(() => ({
        type: 'denied' as const,
        reason: 'policy block',
      }));

      const result = await resolveToolApproval({
        tools: {
          weather: tool({
            inputSchema: z.object({ city: z.string() }),
          }),
        },
        toolApproval: genericToolApproval,
        toolCall: createToolCall(),
        messages: [...messages],
        toolsContext: {},
        runtimeContext: {},
      });

      expect(result).toEqual({
        type: 'denied',
        reason: 'policy block',
      });
    });

    it('passes the same messages and toolsContext references to the generic function', async () => {
      const modelMessages: ModelMessage[] = [
        { role: 'user' as const, content: 'first' },
        { role: 'assistant' as const, content: 'second' },
      ];
      const toolsContext = {
        weather: { scope: 'read' },
        otherTool: { flag: true },
      };
      const runtimeContext = { traceId: 'trace-1' };
      const genericToolApproval = vi.fn(
        (_: {
          toolCall: unknown;
          tools: unknown;
          toolsContext: unknown;
          messages: ModelMessage[];
          runtimeContext: unknown;
        }) => 'not-applicable' as const,
      );

      await resolveToolApproval({
        tools: {
          weather: tool({
            inputSchema: z.object({ city: z.string() }),
          }),
        },
        toolApproval: genericToolApproval,
        toolCall: createToolCall(),
        messages: modelMessages,
        toolsContext,
        runtimeContext,
      });

      expect(genericToolApproval).toHaveBeenCalled();
      const [arg] = genericToolApproval.mock.calls[0]!;
      expect(arg.messages).toBe(modelMessages);
      expect(arg.toolsContext).toBe(toolsContext);
      expect(arg.runtimeContext).toBe(runtimeContext);
    });
  });

  describe('SingleToolApprovalFunction (per-tool approval)', () => {
    it('passes the same messages reference and validated toolContext to the per-tool function', async () => {
      const modelMessages: ModelMessage[] = [
        { role: 'user' as const, content: 'step 1' },
        { role: 'user' as const, content: 'step 2' },
      ];
      const singleToolApproval = vi.fn(
        (
          _input: { city: string },
          _options: {
            toolCallId: string;
            messages: ModelMessage[];
            toolContext: { apiKey: string };
            runtimeContext: Record<string, never>;
          },
        ) => 'approved' as const,
      );

      await resolveToolApproval({
        tools: {
          weather: tool({
            inputSchema: z.object({ city: z.string() }),
            contextSchema: z.object({ apiKey: z.string() }),
          }),
        },
        toolApproval: {
          weather: singleToolApproval,
        },
        toolCall: createToolCall(),
        messages: modelMessages,
        toolsContext: {
          weather: { apiKey: 'secret' },
        },
        runtimeContext: {},
      });

      expect(singleToolApproval).toHaveBeenCalledWith(
        { city: 'Berlin' },
        {
          toolCallId: 'call-1',
          messages: modelMessages,
          toolContext: { apiKey: 'secret' },
          runtimeContext: {},
        },
      );
      expect(singleToolApproval).toHaveBeenCalled();
      const [, secondArg] = singleToolApproval.mock.calls[0]!;
      expect(secondArg.messages).toBe(modelMessages);
    });

    it('passes toolsContext entry through as toolContext after schema validation', async () => {
      const singleToolApproval = vi.fn(
        (
          _input: { city: string },
          _options: {
            toolCallId: string;
            messages: unknown;
            toolContext: unknown;
            runtimeContext: unknown;
          },
        ) => 'not-applicable' as const,
      );

      await resolveToolApproval({
        tools: {
          weather: tool({
            inputSchema: z.object({ city: z.string() }),
            contextSchema: z.object({
              apiKey: z.string(),
              region: z.string().default('us-east-1'),
            }),
          }),
        },
        toolApproval: {
          weather: singleToolApproval,
        },
        toolCall: createToolCall(),
        messages: [...messages],
        // Runtime value before validation omits `region`; zod default is applied in `validateToolContext`.
        toolsContext: { weather: { apiKey: 'k' } } as any,
        runtimeContext: {},
      });

      expect(singleToolApproval).toHaveBeenCalled();
      const [, secondArg] = singleToolApproval.mock.calls[0]!;
      expect(secondArg.toolContext).toEqual({
        apiKey: 'k',
        region: 'us-east-1',
      });
    });

    it('treats undefined returned by a per-tool approval function as not-applicable', async () => {
      const singleToolApproval = vi.fn(() => undefined);

      const result = await resolveToolApproval({
        tools: {
          weather: tool({
            inputSchema: z.object({ city: z.string() }),
          }),
        },
        toolApproval: { weather: singleToolApproval },
        toolCall: createToolCall(),
        messages: [...messages],
        toolsContext: {},
        runtimeContext: {},
      });

      expect(result).toEqual({ type: 'not-applicable' });
    });

    it('treats Promise undefined returned by a per-tool approval function as not-applicable', async () => {
      const singleToolApproval = vi.fn(() => Promise.resolve(undefined));

      const result = await resolveToolApproval({
        tools: {
          weather: tool({
            inputSchema: z.object({ city: z.string() }),
          }),
        },
        toolApproval: { weather: singleToolApproval },
        toolCall: createToolCall(),
        messages: [...messages],
        toolsContext: {},
        runtimeContext: {},
      });

      expect(result).toEqual({ type: 'not-applicable' });
    });
  });

  it('normalizes a user-defined static string approval value before checking tool-defined approval', async () => {
    const toolDefinedNeedsApproval = vi.fn(() => true);

    const result = await resolveToolApproval({
      tools: {
        weather: tool({
          inputSchema: z.object({ city: z.string() }),
          needsApproval: toolDefinedNeedsApproval,
        }),
      },
      toolApproval: {
        weather: 'denied',
      },
      toolCall: createToolCall(),
      messages: [...messages],
      toolsContext: {},
      runtimeContext: {},
    });

    expect(result).toEqual({ type: 'denied' });
    expect(toolDefinedNeedsApproval).not.toHaveBeenCalled();
  });

  it('passes through a user-defined object approval value including its reason', async () => {
    const result = await resolveToolApproval({
      tools: {
        weather: tool({
          inputSchema: z.object({ city: z.string() }),
        }),
      },
      toolApproval: {
        weather: {
          type: 'denied',
          reason: 'blocked by policy',
        },
      },
      toolCall: createToolCall(),
      messages: [...messages],
      toolsContext: {},
      runtimeContext: {},
    });

    expect(result).toEqual({
      type: 'denied',
      reason: 'blocked by policy',
    });
  });

  it('uses a user-defined approval callback before tool-defined approval', async () => {
    const toolDefinedNeedsApproval = vi.fn(() => true);
    const userDefinedNeedsApproval = vi.fn(() => 'approved' as const);

    const result = await resolveToolApproval({
      tools: {
        weather: tool({
          inputSchema: z.object({ city: z.string() }),
          contextSchema: z.object({ apiKey: z.string() }),
          needsApproval: toolDefinedNeedsApproval,
        }),
      },
      toolApproval: {
        weather: userDefinedNeedsApproval,
      },
      toolCall: createToolCall(),
      messages: [...messages],
      toolsContext: {
        weather: { apiKey: 'secret' },
      },
      runtimeContext: {},
    });

    expect(result).toEqual({ type: 'approved' });
    expect(userDefinedNeedsApproval).toHaveBeenCalledTimes(1);
    expect(userDefinedNeedsApproval).toHaveBeenCalledWith(
      { city: 'Berlin' },
      {
        toolCallId: 'call-1',
        messages: [...messages],
        toolContext: { apiKey: 'secret' },
        runtimeContext: {},
      },
    );
    expect(toolDefinedNeedsApproval).not.toHaveBeenCalled();
  });

  it('passes through a reason returned by a user-defined approval callback', async () => {
    const result = await resolveToolApproval({
      tools: {
        weather: tool({
          inputSchema: z.object({ city: z.string() }),
        }),
      },
      toolApproval: {
        weather: vi.fn(() => ({
          type: 'approved' as const,
          reason: 'trusted internal tool',
        })),
      },
      toolCall: createToolCall(),
      messages: [...messages],
      toolsContext: {},
      runtimeContext: {},
    });

    expect(result).toEqual({
      type: 'approved',
      reason: 'trusted internal tool',
    });
  });

  it('passes tool input and options to a user-defined approval callback without a context schema', async () => {
    const userDefinedNeedsApproval = vi.fn(() => 'user-approval' as const);

    await resolveToolApproval({
      tools: {
        weather: tool({
          inputSchema: z.object({ city: z.string() }),
        }),
      },
      toolApproval: {
        weather: userDefinedNeedsApproval,
      },
      toolCall: createToolCall(),
      messages: [...messages],
      toolsContext: {},
      runtimeContext: {},
    });

    expect(userDefinedNeedsApproval).toHaveBeenCalledWith(
      { city: 'Berlin' },
      {
        toolCallId: 'call-1',
        messages: [...messages],
        toolContext: undefined,
        runtimeContext: {},
      },
    );
  });

  it('normalizes a string status returned by a user-defined approval callback', async () => {
    const result = await resolveToolApproval({
      tools: {
        weather: tool({
          inputSchema: z.object({ city: z.string() }),
        }),
      },
      toolApproval: {
        weather: vi.fn(() => 'user-approval' as const),
      },
      toolCall: createToolCall(),
      messages: [...messages],
      toolsContext: {},
      runtimeContext: {},
    });

    expect(result).toEqual({ type: 'user-approval' });
  });

  it('maps tool-defined boolean approval to the public approval state', async () => {
    const approvedToolResult = await resolveToolApproval({
      tools: {
        weather: tool({
          inputSchema: z.object({ city: z.string() }),
          needsApproval: true,
        }),
      },
      toolApproval: undefined,
      toolCall: createToolCall(),
      messages: [...messages],
      toolsContext: {},
      runtimeContext: {},
    });

    const notApplicableToolResult = await resolveToolApproval({
      tools: {
        weather: tool({
          inputSchema: z.object({ city: z.string() }),
          needsApproval: false,
        }),
      },
      toolApproval: undefined,
      toolCall: createToolCall(),
      messages: [...messages],
      toolsContext: {},
      runtimeContext: {},
    });

    expect(approvedToolResult).toEqual({ type: 'user-approval' });
    expect(notApplicableToolResult).toEqual({ type: 'not-applicable' });
  });

  it('passes tool input and validated context to a tool-defined approval callback', async () => {
    const toolDefinedNeedsApproval = vi.fn(() => true);

    const result = await resolveToolApproval({
      tools: {
        weather: tool({
          inputSchema: z.object({ city: z.string() }),
          contextSchema: z.object({ apiKey: z.string() }),
          needsApproval: toolDefinedNeedsApproval,
        }),
      },
      toolApproval: undefined,
      toolCall: createToolCall(),
      messages: [...messages],
      toolsContext: {
        weather: { apiKey: 'secret' },
      },
      runtimeContext: {},
    });

    expect(result).toEqual({ type: 'user-approval' });
    expect(toolDefinedNeedsApproval).toHaveBeenCalledWith(
      { city: 'Berlin' },
      {
        toolCallId: 'call-1',
        messages: [...messages],
        context: { apiKey: 'secret' },
      },
    );
  });

  it('throws TypeValidationError before invoking a user-defined approval callback', async () => {
    const userDefinedNeedsApproval = vi.fn(() => 'user-approval' as const);

    try {
      await resolveToolApproval({
        tools: {
          weather: tool({
            inputSchema: z.object({ city: z.string() }),
            contextSchema: z.object({ apiKey: z.string() }),
            needsApproval: vi.fn(() => true),
          }),
        },
        toolApproval: {
          weather: userDefinedNeedsApproval,
        },
        toolCall: createToolCall(),
        messages: [...messages],
        toolsContext: {
          weather: { apiKey: 123 } as any,
        },
        runtimeContext: {},
      });

      expect.unreachable('expected resolveToolApproval to throw');
    } catch (error) {
      expect(userDefinedNeedsApproval).not.toHaveBeenCalled();

      expect(TypeValidationError.isInstance(error)).toBe(true);

      if (TypeValidationError.isInstance(error)) {
        expect(error.value).toEqual({ apiKey: 123 });
        expect(error.context).toEqual({
          field: 'tool context',
          entityName: 'weather',
        });
      }
    }
  });

  it('throws TypeValidationError before invoking a tool-defined approval callback', async () => {
    const toolDefinedNeedsApproval = vi.fn(() => true);

    try {
      await resolveToolApproval({
        tools: {
          weather: tool({
            inputSchema: z.object({ city: z.string() }),
            contextSchema: z.object({ apiKey: z.string() }),
            needsApproval: toolDefinedNeedsApproval,
          }),
        },
        toolApproval: undefined,
        toolCall: createToolCall(),
        messages: [...messages],
        toolsContext: {
          weather: { apiKey: 123 } as any,
        },
        runtimeContext: {},
      });

      expect.unreachable('expected resolveToolApproval to throw');
    } catch (error) {
      expect(toolDefinedNeedsApproval).not.toHaveBeenCalled();

      expect(TypeValidationError.isInstance(error)).toBe(true);

      if (TypeValidationError.isInstance(error)) {
        expect(error.value).toEqual({ apiKey: 123 });
        expect(error.context).toEqual({
          field: 'tool context',
          entityName: 'weather',
        });
      }
    }
  });
});
