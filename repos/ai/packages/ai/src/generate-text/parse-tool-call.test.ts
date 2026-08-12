import { dynamicTool, jsonSchema, tool } from '@ai-sdk/provider-utils';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { InvalidToolInputError } from '../error/invalid-tool-input-error';
import { parseToolCall } from './parse-tool-call';

describe('parseToolCall', () => {
  it('should successfully parse a valid tool call', async () => {
    const result = await parseToolCall({
      toolCall: {
        type: 'tool-call',
        toolName: 'testTool',
        toolCallId: '123',
        input: '{"param1": "test", "param2": 42}',
      },
      tools: {
        testTool: tool({
          inputSchema: z.object({
            param1: z.string(),
            param2: z.number(),
          }),
        }),
      } as const,
      repairToolCall: undefined,
      messages: [],
      instructions: undefined,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "input": {
          "param1": "test",
          "param2": 42,
        },
        "providerExecuted": undefined,
        "providerMetadata": undefined,
        "title": undefined,
        "toolCallId": "123",
        "toolName": "testTool",
        "type": "tool-call",
      }
    `);
  });

  it('should refine input after successfully parsing a valid tool call', async () => {
    const result = await parseToolCall({
      toolCall: {
        type: 'tool-call',
        toolName: 'testTool',
        toolCallId: '123',
        input: '{"value": " raw "}',
      },
      tools: {
        testTool: tool({
          inputSchema: z.object({
            value: z.string(),
          }),
        }),
      } as const,
      repairToolCall: undefined,
      refineToolInput: {
        testTool: input => ({ value: input.value.trim() }),
      },
      messages: [],
      instructions: undefined,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "input": {
          "value": "raw",
        },
        "providerExecuted": undefined,
        "providerMetadata": undefined,
        "title": undefined,
        "toolCallId": "123",
        "toolName": "testTool",
        "type": "tool-call",
      }
    `);
  });

  it('should successfully parse a valid provider-executed dynamic tool call', async () => {
    const result = await parseToolCall({
      toolCall: {
        type: 'tool-call',
        toolName: 'testTool',
        toolCallId: '123',
        input: '{"param1": "test", "param2": 42}',
        providerExecuted: true,
        dynamic: true,
        providerMetadata: {
          testProvider: {
            signature: 'sig',
          },
        },
      },
      tools: {} as const,
      repairToolCall: undefined,
      messages: [],
      instructions: undefined,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "dynamic": true,
        "input": {
          "param1": "test",
          "param2": 42,
        },
        "providerExecuted": true,
        "providerMetadata": {
          "testProvider": {
            "signature": "sig",
          },
        },
        "toolCallId": "123",
        "toolName": "testTool",
        "type": "tool-call",
      }
    `);
  });

  it('should successfully parse a valid tool call with provider metadata', async () => {
    const result = await parseToolCall({
      toolCall: {
        type: 'tool-call',
        toolName: 'testTool',
        toolCallId: '123',
        input: '{"param1": "test", "param2": 42}',
        providerMetadata: {
          testProvider: {
            signature: 'sig',
          },
        },
      },
      tools: {
        testTool: tool({
          inputSchema: z.object({
            param1: z.string(),
            param2: z.number(),
          }),
        }),
      } as const,
      repairToolCall: undefined,
      messages: [],
      instructions: undefined,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "input": {
          "param1": "test",
          "param2": 42,
        },
        "providerExecuted": undefined,
        "providerMetadata": {
          "testProvider": {
            "signature": "sig",
          },
        },
        "title": undefined,
        "toolCallId": "123",
        "toolName": "testTool",
        "type": "tool-call",
      }
    `);
  });

  it('should successfully process empty tool calls for tools that have no inputSchema', async () => {
    const result = await parseToolCall({
      toolCall: {
        type: 'tool-call',
        toolName: 'testTool',
        toolCallId: '123',
        input: '',
      },
      tools: {
        testTool: tool({
          inputSchema: z.object({}),
        }),
      } as const,
      repairToolCall: undefined,
      messages: [],
      instructions: undefined,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "input": {},
        "providerExecuted": undefined,
        "providerMetadata": undefined,
        "title": undefined,
        "toolCallId": "123",
        "toolName": "testTool",
        "type": "tool-call",
      }
    `);
  });

  it('should successfully process empty object tool calls for tools that have no inputSchema', async () => {
    const result = await parseToolCall({
      toolCall: {
        type: 'tool-call',
        toolName: 'testTool',
        toolCallId: '123',
        input: '{}',
      },
      tools: {
        testTool: tool({
          inputSchema: z.object({}),
        }),
      } as const,
      repairToolCall: undefined,
      messages: [],
      instructions: undefined,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "input": {},
        "providerExecuted": undefined,
        "providerMetadata": undefined,
        "title": undefined,
        "toolCallId": "123",
        "toolName": "testTool",
        "type": "tool-call",
      }
    `);
  });

  it('should throw NoSuchToolError when tools is null', async () => {
    const result = await parseToolCall({
      toolCall: {
        type: 'tool-call',
        toolName: 'testTool',
        toolCallId: '123',
        input: '{}',
      },
      tools: undefined,
      repairToolCall: undefined,
      messages: [],
      instructions: undefined,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "dynamic": true,
        "error": [AI_NoSuchToolError: Model tried to call unavailable tool 'testTool'. No tools are available.],
        "input": {},
        "invalid": true,
        "providerExecuted": undefined,
        "providerMetadata": undefined,
        "title": undefined,
        "toolCallId": "123",
        "toolName": "testTool",
        "type": "tool-call",
      }
    `);
  });

  it('should throw NoSuchToolError when tool is not found', async () => {
    const result = await parseToolCall({
      toolCall: {
        type: 'tool-call',
        toolName: 'nonExistentTool',
        toolCallId: '123',
        input: '{}',
      },
      tools: {
        testTool: tool({
          inputSchema: z.object({
            param1: z.string(),
            param2: z.number(),
          }),
        }),
      } as const,
      repairToolCall: undefined,
      messages: [],
      instructions: undefined,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "dynamic": true,
        "error": [AI_NoSuchToolError: Model tried to call unavailable tool 'nonExistentTool'. Available tools: testTool.],
        "input": {},
        "invalid": true,
        "providerExecuted": undefined,
        "providerMetadata": undefined,
        "title": undefined,
        "toolCallId": "123",
        "toolName": "nonExistentTool",
        "type": "tool-call",
      }
    `);
  });

  it('should throw InvalidToolInputError when args are invalid', async () => {
    const result = await parseToolCall({
      toolCall: {
        type: 'tool-call',
        toolName: 'testTool',
        toolCallId: '123',
        input: '{"param1": "test"}', // Missing required param2
      },
      tools: {
        testTool: tool({
          inputSchema: z.object({
            param1: z.string(),
            param2: z.number(),
          }),
        }),
      } as const,
      repairToolCall: undefined,
      messages: [],
      instructions: undefined,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "dynamic": true,
        "error": [AI_InvalidToolInputError: Invalid input for tool testTool: AI_TypeValidationError: Type validation failed: Value: {"param1":"test"}.
      Error message: [
        {
          "expected": "number",
          "code": "invalid_type",
          "path": [
            "param2"
          ],
          "message": "Invalid input: expected number, received undefined"
        }
      ]],
        "input": {
          "param1": "test",
        },
        "invalid": true,
        "providerExecuted": undefined,
        "providerMetadata": undefined,
        "title": undefined,
        "toolCallId": "123",
        "toolName": "testTool",
        "type": "tool-call",
      }
    `);
  });

  describe('tool call repair', () => {
    it('should invoke repairTool when provided and use its result', async () => {
      const repairToolCall = vi.fn().mockResolvedValue({
        toolCallType: 'function',
        toolName: 'testTool',
        toolCallId: '123',
        input: '{"param1": "test", "param2": 42}',
      });

      const result = await parseToolCall({
        toolCall: {
          type: 'tool-call',
          toolName: 'testTool',
          toolCallId: '123',
          input: 'invalid json', // This will trigger repair
        },
        tools: {
          testTool: tool({
            inputSchema: z.object({
              param1: z.string(),
              param2: z.number(),
            }),
          }),
        } as const,
        repairToolCall,
        messages: [{ role: 'user', content: 'test message' }],
        instructions: 'test instructions',
      });

      // Verify repair function was called
      expect(repairToolCall).toHaveBeenCalledTimes(1);
      expect(repairToolCall).toHaveBeenCalledWith({
        toolCall: expect.objectContaining({
          toolName: 'testTool',
          input: 'invalid json',
        }),
        tools: expect.any(Object),
        inputSchema: expect.any(Function),
        messages: [{ role: 'user', content: 'test message' }],
        instructions: 'test instructions',
        system: 'test instructions',
        error: expect.any(InvalidToolInputError),
      });

      // Verify the repaired result was used
      expect(result).toMatchInlineSnapshot(`
        {
          "input": {
            "param1": "test",
            "param2": 42,
          },
          "providerExecuted": undefined,
          "providerMetadata": undefined,
          "title": undefined,
          "toolCallId": "123",
          "toolName": "testTool",
          "type": "tool-call",
        }
      `);
    });

    it('should pass instructions to repairToolCall', async () => {
      const repairToolCall = vi.fn().mockResolvedValue({
        type: 'tool-call',
        toolName: 'testTool',
        toolCallId: '123',
        input: '{"param1": "test", "param2": 42}',
      });

      const result = await parseToolCall({
        toolCall: {
          type: 'tool-call',
          toolName: 'testTool',
          toolCallId: '123',
          input: 'invalid json',
        },
        tools: {
          testTool: tool({
            inputSchema: z.object({
              param1: z.string(),
              param2: z.number(),
            }),
          }),
        } as const,
        repairToolCall,
        messages: [],
        instructions: 'test instructions',
      });

      expect(repairToolCall).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: 'test instructions',
          system: 'test instructions',
        }),
      );
      expect(result.input).toStrictEqual({ param1: 'test', param2: 42 });
    });

    it('should re-throw error if tool call repair returns null', async () => {
      const repairToolCall = vi.fn().mockResolvedValue(null);

      const result = await parseToolCall({
        toolCall: {
          type: 'tool-call',
          toolName: 'testTool',
          toolCallId: '123',
          input: 'invalid json',
        },
        tools: {
          testTool: tool({
            inputSchema: z.object({
              param1: z.string(),
              param2: z.number(),
            }),
          }),
        } as const,
        repairToolCall,
        messages: [],
        instructions: undefined,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "dynamic": true,
          "error": [AI_InvalidToolInputError: Invalid input for tool testTool: AI_JSONParseError: JSON parsing failed: Text: invalid json.
        Error message: SyntaxError: Unexpected token 'i', "invalid json" is not valid JSON],
          "input": "invalid json",
          "invalid": true,
          "providerExecuted": undefined,
          "providerMetadata": undefined,
          "title": undefined,
          "toolCallId": "123",
          "toolName": "testTool",
          "type": "tool-call",
        }
      `);
    });

    it('should throw ToolCallRepairError if repairToolCall throws', async () => {
      const repairToolCall = vi.fn().mockRejectedValue(new Error('test error'));

      const result = await parseToolCall({
        toolCall: {
          type: 'tool-call',
          toolName: 'testTool',
          toolCallId: '123',
          input: 'invalid json',
        },
        tools: {
          testTool: tool({
            inputSchema: z.object({
              param1: z.string(),
              param2: z.number(),
            }),
          }),
        } as const,
        repairToolCall,
        messages: [],
        instructions: undefined,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "dynamic": true,
          "error": [AI_ToolCallRepairError: Error repairing tool call: Error: test error],
          "input": "invalid json",
          "invalid": true,
          "providerExecuted": undefined,
          "providerMetadata": undefined,
          "title": undefined,
          "toolCallId": "123",
          "toolName": "testTool",
          "type": "tool-call",
        }
      `);
    });
  });

  it('should set dynamic to true for dynamic tools', async () => {
    const result = await parseToolCall({
      toolCall: {
        type: 'tool-call',
        toolName: 'testTool',
        toolCallId: '123',
        input: '{"param1": "test", "param2": 42}',
      },
      tools: {
        testTool: dynamicTool({
          inputSchema: z.object({
            param1: z.string(),
            param2: z.number(),
          }),
          execute: async () => 'result',
        }),
      } as const,
      repairToolCall: undefined,
      messages: [],
      instructions: undefined,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "dynamic": true,
        "input": {
          "param1": "test",
          "param2": 42,
        },
        "providerExecuted": undefined,
        "providerMetadata": undefined,
        "title": undefined,
        "toolCallId": "123",
        "toolName": "testTool",
        "type": "tool-call",
      }
    `);
  });

  describe('tool title', () => {
    it('should include title in parsed dynamic tool call', async () => {
      const result = await parseToolCall({
        toolCall: {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'weather',
          input: '{"location":"Paris"}',
        },
        tools: {
          weather: {
            type: 'dynamic',
            title: 'Weather Information',
            description: 'Get weather',
            inputSchema: jsonSchema({
              type: 'object',
              properties: { location: { type: 'string' } },
              additionalProperties: false,
            }),
            execute: async () => 'sunny',
          },
        },
        repairToolCall: undefined,
        instructions: undefined,
        messages: [],
      });

      expect(result.title).toBe('Weather Information');
      expect(result.dynamic).toBe(true);
    });

    it('should include title in parsed static tool call', async () => {
      const result = await parseToolCall({
        toolCall: {
          type: 'tool-call',
          toolCallId: 'call-2',
          toolName: 'calculator',
          input: '{"a":5,"b":3}',
        },
        tools: {
          calculator: {
            title: 'Calculator',
            description: 'Calculate',
            inputSchema: z.object({ a: z.number(), b: z.number() }),
            execute: async ({ a, b }) => a + b,
          },
        },
        repairToolCall: undefined,
        instructions: undefined,
        messages: [],
      });

      expect(result.title).toBe('Calculator');
      expect(result.dynamic).toBeUndefined();
    });

    it('should include title in invalid tool call', async () => {
      const result = await parseToolCall({
        toolCall: {
          type: 'tool-call',
          toolCallId: 'call-4',
          toolName: 'invalidTool',
          input: 'invalid json',
        },
        tools: {
          invalidTool: {
            title: 'Invalid Tool',
            description: 'Tool that will fail',
            inputSchema: z.object({ required: z.string() }),
            execute: async () => 'result',
          },
        },
        repairToolCall: undefined,
        instructions: undefined,
        messages: [],
      });

      expect(result.invalid).toBe(true);
      expect(result.title).toBe('Invalid Tool');
    });
  });

  describe('tool metadata propagation', () => {
    it('should propagate tool metadata onto a parsed dynamic tool call', async () => {
      const result = await parseToolCall({
        toolCall: {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'weather',
          input: '{"location":"Paris"}',
        },
        tools: {
          weather: dynamicTool({
            description: 'Get weather',
            metadata: { clientName: 'MyMCPClient' },
            inputSchema: jsonSchema({
              type: 'object',
              properties: { location: { type: 'string' } },
              additionalProperties: false,
            }),
            execute: async () => 'sunny',
          }),
        },
        repairToolCall: undefined,
        instructions: undefined,
        messages: [],
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "dynamic": true,
          "input": {
            "location": "Paris",
          },
          "providerExecuted": undefined,
          "providerMetadata": undefined,
          "title": undefined,
          "toolCallId": "call-1",
          "toolMetadata": {
            "clientName": "MyMCPClient",
          },
          "toolName": "weather",
          "type": "tool-call",
        }
      `);
    });

    it('should propagate tool metadata onto a parsed static tool call', async () => {
      const result = await parseToolCall({
        toolCall: {
          type: 'tool-call',
          toolCallId: 'call-2',
          toolName: 'calculator',
          input: '{"a":5,"b":3}',
        },
        tools: {
          calculator: tool({
            description: 'Calculate',
            metadata: { clientName: 'MyMCPClient' },
            inputSchema: z.object({ a: z.number(), b: z.number() }),
            execute: async ({ a, b }) => a + b,
          }),
        },
        repairToolCall: undefined,
        instructions: undefined,
        messages: [],
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "input": {
            "a": 5,
            "b": 3,
          },
          "providerExecuted": undefined,
          "providerMetadata": undefined,
          "title": undefined,
          "toolCallId": "call-2",
          "toolMetadata": {
            "clientName": "MyMCPClient",
          },
          "toolName": "calculator",
          "type": "tool-call",
        }
      `);
    });

    it('should keep tool metadata separate from model-supplied providerMetadata', async () => {
      const result = await parseToolCall({
        toolCall: {
          type: 'tool-call',
          toolCallId: 'call-3',
          toolName: 'weather',
          input: '{"location":"Paris"}',
          providerMetadata: {
            anthropic: { cacheControl: { type: 'ephemeral' } },
          },
        },
        tools: {
          weather: dynamicTool({
            description: 'Get weather',
            metadata: { clientName: 'MyMCPClient' },
            inputSchema: jsonSchema({
              type: 'object',
              properties: { location: { type: 'string' } },
              additionalProperties: false,
            }),
            execute: async () => 'sunny',
          }),
        },
        repairToolCall: undefined,
        instructions: undefined,
        messages: [],
      });

      expect({
        providerMetadata: result.providerMetadata,
        toolMetadata: result.toolMetadata,
      }).toMatchInlineSnapshot(`
        {
          "providerMetadata": {
            "anthropic": {
              "cacheControl": {
                "type": "ephemeral",
              },
            },
          },
          "toolMetadata": {
            "clientName": "MyMCPClient",
          },
        }
      `);
    });

    it('should propagate tool metadata onto an invalid tool call', async () => {
      const result = await parseToolCall({
        toolCall: {
          type: 'tool-call',
          toolCallId: 'call-4',
          toolName: 'weather',
          input: 'invalid json',
        },
        tools: {
          weather: dynamicTool({
            description: 'Get weather',
            metadata: { clientName: 'MyMCPClient' },
            inputSchema: jsonSchema({
              type: 'object',
              properties: { location: { type: 'string' } },
              required: ['location'],
              additionalProperties: false,
            }),
            execute: async () => 'sunny',
          }),
        },
        repairToolCall: undefined,
        instructions: undefined,
        messages: [],
      });

      expect({
        invalid: result.invalid,
        toolMetadata: result.toolMetadata,
      }).toMatchInlineSnapshot(`
        {
          "invalid": true,
          "toolMetadata": {
            "clientName": "MyMCPClient",
          },
        }
      `);
    });
  });
});
