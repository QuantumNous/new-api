/**
 * Tests for WorkflowAgent
 *
 * These tests focus on error handling in tool execution,
 * particularly for FatalError conversion to tool result errors,
 * and verifying that messages are properly passed to tool execute functions.
 */
import {
  InvalidPromptError,
  type LanguageModelV4,
  type LanguageModelV4Prompt,
  type LanguageModelV4ToolCall,
  type LanguageModelV4ToolResultPart,
} from '@ai-sdk/provider';
import {
  tool,
  type Experimental_SandboxSession as SandboxSession,
  type StepResult,
  type ToolSet,
} from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { FatalError } from 'workflow';
import { z } from 'zod/v4';
import { createTestSandbox } from './test/test-sandbox.js';
import type { ParsedToolCall } from './do-stream-step.js';
import type { StreamTextIteratorYieldValue } from './stream-text-iterator.js';
import type {
  PrepareStepCallback,
  ToolCallRepairFunction,
} from './workflow-agent.js';

// Mock the streamTextIterator
vi.mock('./stream-text-iterator.js', () => ({
  streamTextIterator: vi.fn(),
}));

// Import after mocking
const { WorkflowAgent } = await import('./workflow-agent.js');

/**
 * Creates a mock LanguageModelV4 for testing
 */
function createMockModel(): LanguageModelV4 {
  return {
    specificationVersion: 'v4' as const,
    provider: 'test',
    modelId: 'test-model',
    doGenerate: vi.fn(),
    doStream: vi.fn(),
    supportedUrls: {},
  };
}

/**
 * Type for the mock iterator used in tests
 */
type MockIterator = AsyncGenerator<
  StreamTextIteratorYieldValue,
  LanguageModelV4Prompt,
  LanguageModelV4ToolResultPart[]
>;

describe('WorkflowAgent', () => {
  describe('id property', () => {
    it('should expose id when provided in constructor', () => {
      const agent = new WorkflowAgent({
        model: createMockModel(),
        id: 'my-agent',
      });
      expect(agent.id).toBe('my-agent');
    });

    it('should be undefined when not provided', () => {
      const agent = new WorkflowAgent({
        model: createMockModel(),
      });
      expect(agent.id).toBeUndefined();
    });
  });

  describe('user-agent', () => {
    async function runStream(headers?: Record<string, string>) {
      const { streamTextIterator } = await import('./stream-text-iterator.js');
      vi.mocked(streamTextIterator).mockReturnValue({
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      } as unknown as MockIterator);

      const agent = new WorkflowAgent({ model: createMockModel() });
      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: new WritableStream({ write: vi.fn(), close: vi.fn() }),
        ...(headers ? { headers } : {}),
      });

      const call = vi.mocked(streamTextIterator).mock.calls.at(-1)?.[0];
      return (call?.generationSettings?.headers ?? {}) as Record<
        string,
        string
      >;
    }

    it('should tag the user-agent with the agent identifier', async () => {
      const headers = await runStream();
      expect(headers['user-agent']).toContain('ai-sdk-agent/workflow');
    });

    it('should preserve a caller-provided user-agent', async () => {
      const headers = await runStream({ 'user-agent': 'my-app/1.0' });
      expect(headers['user-agent']).toContain('my-app/1.0');
      expect(headers['user-agent']).toContain('ai-sdk-agent/workflow');
    });
  });

  describe('tool execution error handling', () => {
    it('should convert FatalError to tool error result', async () => {
      const errorMessage = 'This is a fatal error';
      const tools: ToolSet = {
        testTool: {
          description: 'A test tool',
          inputSchema: z.object({}),
          execute: async () => {
            throw new FatalError(errorMessage);
          },
        },
      };

      // We need to test the executeTool function indirectly through the agent
      // Create a mock model that will trigger tool calls
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools,
      });

      // Create a mock writable stream
      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      // Mock the streamTextIterator to return tool calls and then complete
      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'test' }] },
      ];
      const mockIterator = {
        next: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [
                {
                  toolCallId: 'test-call-id',
                  toolName: 'testTool',
                  input: '{}',
                } as LanguageModelV4ToolCall,
              ],
              messages: mockMessages,
            },
          })
          .mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      // Execute the stream - this should not throw even though the tool throws FatalError
      await expect(
        agent.stream({
          messages: [{ role: 'user', content: 'test' }],
          writable: mockWritable,
        }),
      ).resolves.not.toThrow();

      // Verify that the iterator was called with tool results including the error
      expect(mockIterator.next).toHaveBeenCalledTimes(2);
      const toolResultsCall = mockIterator.next.mock.calls[1][0];
      expect(toolResultsCall).toBeDefined();
      expect(toolResultsCall).toHaveLength(1);
      expect(toolResultsCall[0]).toMatchObject({
        type: 'tool-result',
        toolCallId: 'test-call-id',
        toolName: 'testTool',
        output: {
          type: 'error-text',
          value: `FatalError: ${errorMessage}`,
        },
      });
    });

    it('should convert non-FatalError to tool error result', async () => {
      const errorMessage = 'This is a generic error';
      const tools: ToolSet = {
        testTool: {
          description: 'A test tool',
          inputSchema: z.object({}),
          execute: async () => {
            throw new Error(errorMessage);
          },
        },
      };

      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'test' }] },
      ];
      const mockIterator = {
        next: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [
                {
                  toolCallId: 'test-call-id',
                  toolName: 'testTool',
                  input: '{}',
                } as LanguageModelV4ToolCall,
              ],
              messages: mockMessages,
            },
          })
          .mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      // Non-FatalError should be converted to error-text, not re-thrown
      await expect(
        agent.stream({
          messages: [{ role: 'user', content: 'test' }],
          writable: mockWritable,
        }),
      ).resolves.not.toThrow();

      // Verify the error was converted to a tool error result
      expect(mockIterator.next).toHaveBeenCalledTimes(2);
      const toolResultsCall = mockIterator.next.mock.calls[1][0];
      expect(toolResultsCall).toBeDefined();
      expect(toolResultsCall).toHaveLength(1);
      expect(toolResultsCall[0]).toMatchObject({
        type: 'tool-result',
        toolCallId: 'test-call-id',
        toolName: 'testTool',
        output: {
          type: 'error-text',
          value: `Error: ${errorMessage}`,
        },
      });
    });

    it('should successfully execute tools that return normally', async () => {
      const toolResult = { success: true, data: 'test result' };
      const tools: ToolSet = {
        testTool: {
          description: 'A test tool',
          inputSchema: z.object({}),
          execute: async () => toolResult,
        },
      };

      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'test' }] },
      ];
      const mockIterator = {
        next: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [
                {
                  toolCallId: 'test-call-id',
                  toolName: 'testTool',
                  input: '{}',
                } as LanguageModelV4ToolCall,
              ],
              messages: mockMessages,
            },
          })
          .mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
      });

      // Verify that the iterator was called with successful tool results
      expect(mockIterator.next).toHaveBeenCalledTimes(2);
      const toolResultsCall = mockIterator.next.mock.calls[1][0];
      expect(toolResultsCall).toBeDefined();
      expect(toolResultsCall).toHaveLength(1);
      expect(toolResultsCall[0]).toMatchObject({
        type: 'tool-result',
        toolCallId: 'test-call-id',
        toolName: 'testTool',
        output: {
          // Object results use 'json' type with raw value (not stringified)
          type: 'json',
          value: toolResult,
        },
      });
    });

    it('should use toModelOutput for local tool results while preserving raw output', async () => {
      const rawToolResult = { public: 'visible to user', secret: 'hide me' };
      const toolInput = { query: 'test query' };
      const toModelOutput = vi.fn(
        ({ output }: { output: typeof rawToolResult }) => ({
          type: 'text' as const,
          value: `model sees: ${output.public}`,
        }),
      );
      const tools: ToolSet = {
        testTool: {
          description: 'A test tool',
          inputSchema: z.object({ query: z.string() }),
          execute: async () => rawToolResult,
          toModelOutput,
        },
      };

      const agent = new WorkflowAgent({
        model: createMockModel(),
        tools,
      });

      const write = vi.fn();
      const mockWritable = new WritableStream({
        write,
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'test' }] },
      ];
      const mockIterator = {
        next: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [
                {
                  type: 'tool-call',
                  toolCallId: 'test-call-id',
                  toolName: 'testTool',
                  input: toolInput,
                } as unknown as LanguageModelV4ToolCall,
              ],
              messages: mockMessages,
            },
          })
          .mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      const result = await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
      });

      expect(toModelOutput).toHaveBeenCalledWith({
        toolCallId: 'test-call-id',
        input: toolInput,
        output: rawToolResult,
      });

      const continuationToolResults = mockIterator.next.mock.calls[1][0];
      expect(continuationToolResults[0]).toMatchObject({
        type: 'tool-result',
        toolCallId: 'test-call-id',
        toolName: 'testTool',
        output: {
          type: 'text',
          value: 'model sees: visible to user',
        },
      });
      expect(result.toolResults[0]).toMatchObject({
        type: 'tool-result',
        toolCallId: 'test-call-id',
        toolName: 'testTool',
        input: toolInput,
        output: rawToolResult,
      });
      expect(write.mock.calls.map(([chunk]) => chunk)).toContainEqual(
        expect.objectContaining({
          type: 'tool-result',
          toolCallId: 'test-call-id',
          output: rawToolResult,
        }),
      );
    });

    it('should skip local execution for provider-executed tools', async () => {
      // This tool should NOT be called because the tool call is provider-executed
      const executeFn = vi.fn();
      const tools: ToolSet = {
        // This is a local tool - should never be called for provider-executed calls
        localTool: {
          description: 'A local tool',
          inputSchema: z.object({}),
          execute: executeFn,
        },
      };

      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'test' }] },
      ];

      // Create a provider-executed tool result map
      const providerExecutedToolResults = new Map();
      providerExecutedToolResults.set('provider-call-id', {
        toolCallId: 'provider-call-id',
        toolName: 'WebSearch',
        result: 'Search results for: test query',
        isError: false,
      });

      const mockIterator = {
        next: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [
                {
                  toolCallId: 'provider-call-id',
                  toolName: 'WebSearch',
                  input: '{"query":"test query"}',
                  providerExecuted: true, // This is a provider-executed tool
                } as LanguageModelV4ToolCall,
              ],
              messages: mockMessages,
              providerExecutedToolResults,
            },
          })
          .mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
      });

      // The local tool execute function should NOT have been called
      expect(executeFn).not.toHaveBeenCalled();

      // Verify that the iterator was called with the provider-executed tool result
      expect(mockIterator.next).toHaveBeenCalledTimes(2);
      const toolResultsCall = mockIterator.next.mock.calls[1][0];
      expect(toolResultsCall).toBeDefined();
      expect(toolResultsCall).toHaveLength(1);
      expect(toolResultsCall[0]).toMatchObject({
        type: 'tool-result',
        toolCallId: 'provider-call-id',
        toolName: 'WebSearch',
        output: {
          // String results use 'text' type with raw value
          type: 'text',
          value: 'Search results for: test query',
        },
      });
    });

    it('should use toModelOutput for provider-executed tool results while preserving raw output', async () => {
      const rawProviderResult = {
        public: 'provider result',
        secret: 'hide me',
      };
      const toolInput = { query: 'test query' };
      const executeFn = vi.fn();
      const toModelOutput = vi.fn(
        ({ output }: { output: typeof rawProviderResult }) => ({
          type: 'text' as const,
          value: `model sees: ${output.public}`,
        }),
      );
      const tools: ToolSet = {
        WebSearch: {
          description: 'A provider-executed tool',
          inputSchema: z.object({ query: z.string() }),
          execute: executeFn,
          toModelOutput,
        },
      };

      const agent = new WorkflowAgent({
        model: createMockModel(),
        tools,
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'test' }] },
      ];
      const providerExecutedToolResults = new Map();
      providerExecutedToolResults.set('provider-call-id', {
        toolCallId: 'provider-call-id',
        toolName: 'WebSearch',
        result: rawProviderResult,
        isError: false,
      });

      const mockIterator = {
        next: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [
                {
                  type: 'tool-call',
                  toolCallId: 'provider-call-id',
                  toolName: 'WebSearch',
                  input: toolInput,
                  providerExecuted: true,
                } as unknown as LanguageModelV4ToolCall,
              ],
              messages: mockMessages,
              providerExecutedToolResults,
            },
          })
          .mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      const result = await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(executeFn).not.toHaveBeenCalled();
      expect(toModelOutput).toHaveBeenCalledWith({
        toolCallId: 'provider-call-id',
        input: toolInput,
        output: rawProviderResult,
      });

      const continuationToolResults = mockIterator.next.mock.calls[1][0];
      expect(continuationToolResults[0]).toMatchObject({
        type: 'tool-result',
        toolCallId: 'provider-call-id',
        toolName: 'WebSearch',
        output: {
          type: 'text',
          value: 'model sees: provider result',
        },
      });
      expect(result.toolResults[0]).toMatchObject({
        type: 'tool-result',
        toolCallId: 'provider-call-id',
        toolName: 'WebSearch',
        input: toolInput,
        output: rawProviderResult,
      });
    });

    it('should handle mixed provider-executed and local tools', async () => {
      const localToolResult = { local: 'result' };
      const localExecuteFn = vi.fn().mockResolvedValue(localToolResult);
      const tools: ToolSet = {
        localTool: {
          description: 'A local tool',
          inputSchema: z.object({}),
          execute: localExecuteFn,
        },
      };

      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'test' }] },
      ];

      // Create a provider-executed tool result map
      const providerExecutedToolResults = new Map();
      providerExecutedToolResults.set('provider-call-id', {
        toolCallId: 'provider-call-id',
        toolName: 'WebSearch',
        result: { searchResults: ['result1', 'result2'] },
        isError: false,
      });

      const mockIterator = {
        next: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [
                // Local tool call - should be executed locally
                {
                  toolCallId: 'local-call-id',
                  toolName: 'localTool',
                  input: '{}',
                  providerExecuted: false,
                } as LanguageModelV4ToolCall,
                // Provider-executed tool call - should use stream result
                {
                  toolCallId: 'provider-call-id',
                  toolName: 'WebSearch',
                  input: '{"query":"test"}',
                  providerExecuted: true,
                } as LanguageModelV4ToolCall,
              ],
              messages: mockMessages,
              providerExecutedToolResults,
            },
          })
          .mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
      });

      // The local tool execute function SHOULD have been called
      expect(localExecuteFn).toHaveBeenCalledTimes(1);

      // Verify that the iterator was called with both tool results
      expect(mockIterator.next).toHaveBeenCalledTimes(2);
      const toolResultsCall = mockIterator.next.mock.calls[1][0];
      expect(toolResultsCall).toBeDefined();
      expect(toolResultsCall).toHaveLength(2);

      // First result should be from local tool (object result uses 'json' type)
      expect(toolResultsCall[0]).toMatchObject({
        type: 'tool-result',
        toolCallId: 'local-call-id',
        toolName: 'localTool',
        output: {
          type: 'json',
          value: localToolResult,
        },
      });

      // Second result should be from provider-executed tool (object result uses 'json' type)
      expect(toolResultsCall[1]).toMatchObject({
        type: 'tool-result',
        toolCallId: 'provider-call-id',
        toolName: 'WebSearch',
        output: {
          type: 'json',
          value: { searchResults: ['result1', 'result2'] },
        },
      });
    });

    it('should handle provider-executed tool errors with isError flag', async () => {
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'test' }] },
      ];

      // Create a provider-executed tool result with isError: true
      const providerExecutedToolResults = new Map();
      providerExecutedToolResults.set('provider-call-id', {
        toolCallId: 'provider-call-id',
        toolName: 'WebSearch',
        result: 'Search failed: Rate limit exceeded',
        isError: true,
      });

      const mockIterator = {
        next: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [
                {
                  toolCallId: 'provider-call-id',
                  toolName: 'WebSearch',
                  input: '{"query":"test query"}',
                  providerExecuted: true,
                } as LanguageModelV4ToolCall,
              ],
              messages: mockMessages,
              providerExecutedToolResults,
            },
          })
          .mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
      });

      // Verify that the iterator was called with error-text output type
      expect(mockIterator.next).toHaveBeenCalledTimes(2);
      const toolResultsCall = mockIterator.next.mock.calls[1][0];
      expect(toolResultsCall).toBeDefined();
      expect(toolResultsCall).toHaveLength(1);
      expect(toolResultsCall[0]).toMatchObject({
        type: 'tool-result',
        toolCallId: 'provider-call-id',
        toolName: 'WebSearch',
        output: {
          // String error results use 'error-text' type with raw value
          type: 'error-text',
          value: 'Search failed: Rate limit exceeded',
        },
      });
    });

    it('should warn and return empty result when provider-executed tool result is missing', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'test' }] },
      ];

      // Empty map - no provider results available
      const providerExecutedToolResults = new Map();

      const mockIterator = {
        next: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [
                {
                  toolCallId: 'missing-result-id',
                  toolName: 'WebSearch',
                  input: '{"query":"test query"}',
                  providerExecuted: true,
                } as LanguageModelV4ToolCall,
              ],
              messages: mockMessages,
              providerExecutedToolResults,
            },
          })
          .mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
      });

      // Verify warning was logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Provider-executed tool "WebSearch"'),
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing-result-id'),
      );

      // Verify empty result was returned
      const toolResultsCall = mockIterator.next.mock.calls[1][0];
      expect(toolResultsCall).toBeDefined();
      expect(toolResultsCall).toHaveLength(1);
      expect(toolResultsCall[0]).toMatchObject({
        type: 'tool-result',
        toolCallId: 'missing-result-id',
        toolName: 'WebSearch',
        output: {
          type: 'text',
          value: '',
        },
      });

      consoleWarnSpy.mockRestore();
    });

    it('should keep invalid tool calls on the error path without executing them', async () => {
      const execute = vi.fn(async () => 'should-not-run');
      const tools: ToolSet = {
        testTool: {
          description: 'A test tool',
          inputSchema: z.object({ city: z.string() }),
          execute,
        },
      };

      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools,
      });

      const writes: any[] = [];
      const mockWritable = new WritableStream({
        write: chunk => {
          writes.push(chunk);
        },
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const invalidError = new Error('Invalid input for tool testTool');
      const mockMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'test' }] },
      ];
      const finalMessages: LanguageModelV4Prompt = [
        ...mockMessages,
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'done',
            },
          ],
        },
      ];
      const mockIterator = {
        next: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [
                {
                  type: 'tool-call',
                  toolCallId: 'invalid-call-id',
                  toolName: 'testTool',
                  input: { cities: 'San Francisco' },
                  invalid: true,
                  error: invalidError,
                } satisfies ParsedToolCall,
              ],
              messages: mockMessages,
            },
          })
          .mockResolvedValueOnce({
            done: true,
            value: finalMessages,
          }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      const result = await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
      });

      expect(execute).not.toHaveBeenCalled();
      expect(mockIterator.next).toHaveBeenCalledTimes(2);
      expect(mockIterator.next.mock.calls[1][0]).toMatchInlineSnapshot(`
        [
          {
            "output": {
              "type": "error-text",
              "value": "Error: Invalid input for tool testTool",
            },
            "toolCallId": "invalid-call-id",
            "toolName": "testTool",
            "type": "tool-result",
          },
        ]
      `);
      expect(writes).toEqual([
        { type: 'finish-step' },
        { type: 'start-step' },
        { type: 'finish' },
      ]);
      expect(result.toolCalls).toMatchObject([
        {
          type: 'tool-call',
          toolCallId: 'invalid-call-id',
          toolName: 'testTool',
          input: { cities: 'San Francisco' },
        },
      ]);
      expect(result.toolResults).toHaveLength(0);
    });
  });

  describe('experimental_sandbox', () => {
    async function runWithSandbox(options: {
      constructorSandbox?: SandboxSession;
      streamSandbox?: SandboxSession;
    }) {
      let receivedSandbox: SandboxSession | undefined;
      const agent = new WorkflowAgent({
        model: createMockModel(),
        experimental_sandbox: options.constructorSandbox,
        tools: {
          testTool: tool({
            description: 'A test tool',
            inputSchema: z.object({}),
            execute: async (_input, { experimental_sandbox }) => {
              receivedSandbox = experimental_sandbox;
              return 'ok';
            },
          }),
        },
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'test' }] },
      ];
      const mockIterator = {
        next: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [
                {
                  toolCallId: 'test-call-id',
                  toolName: 'testTool',
                  input: '{}',
                } as LanguageModelV4ToolCall,
              ],
              messages: mockMessages,
            },
          })
          .mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: new WritableStream({ write: vi.fn(), close: vi.fn() }),
        experimental_sandbox: options.streamSandbox,
      });

      return receivedSandbox;
    }

    it('should pass the stream-level sandbox to tool execution', async () => {
      const sandbox = createTestSandbox();
      expect(await runWithSandbox({ streamSandbox: sandbox })).toBe(sandbox);
    });

    it('should pass the constructor-level sandbox to tool execution', async () => {
      const sandbox = createTestSandbox();
      expect(await runWithSandbox({ constructorSandbox: sandbox })).toBe(
        sandbox,
      );
    });

    it('should let the stream-level sandbox override the constructor-level sandbox', async () => {
      const constructorSandbox = createTestSandbox();
      const streamSandbox = createTestSandbox();
      expect(await runWithSandbox({ constructorSandbox, streamSandbox })).toBe(
        streamSandbox,
      );
    });

    it('should pass undefined when no sandbox is configured', async () => {
      expect(await runWithSandbox({})).toBeUndefined();
    });
  });

  describe('client-side tools (tools without execute)', () => {
    it('should stop the loop and return unresolved toolCalls for tools without execute', async () => {
      const tools: ToolSet = {
        askUser: {
          description: 'Ask the user a question',
          inputSchema: z.object({ question: z.string() }),
          // No execute function - this is a client-side tool
        },
      };

      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'test' }] },
      ];

      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({
          done: false,
          value: {
            toolCalls: [
              {
                toolCallId: 'ask-user-call-id',
                toolName: 'askUser',
                input: { question: 'What is your name?' },
                providerExecuted: false,
              } as ParsedToolCall,
            ],
            messages: mockMessages,
          },
        }),
        // Note: no second call - the loop should stop before calling next again
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      const result = await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
      });

      // The loop should have stopped - iterator.next called only once
      expect(mockIterator.next).toHaveBeenCalledTimes(1);

      // toolCalls should contain the call (matches AI SDK convention)
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]).toEqual({
        type: 'tool-call',
        toolCallId: 'ask-user-call-id',
        toolName: 'askUser',
        input: { question: 'What is your name?' },
      });

      // toolResults should be empty (no execute function → not executed)
      expect(result.toolResults).toHaveLength(0);

      // Messages should include the conversation up to the tool call (from iterMessages),
      // not just the original input messages, so callers can resume
      expect(result.messages).toBe(mockMessages);
    });

    it('should handle mixed executable and client-side tools in the same step', async () => {
      const localToolResult = { data: 'from-server' };
      const localExecuteFn = vi.fn().mockResolvedValue(localToolResult);
      const tools: ToolSet = {
        serverTool: {
          description: 'A server-side tool',
          inputSchema: z.object({}),
          execute: localExecuteFn,
        },
        clientTool: {
          description: 'A client-side tool',
          inputSchema: z.object({ prompt: z.string() }),
          // No execute function
        },
      };

      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools,
      });

      const writtenChunks: unknown[] = [];
      const mockWritable = new WritableStream({
        write: chunk => {
          writtenChunks.push(chunk);
        },
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'test' }] },
      ];

      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({
          done: false,
          value: {
            toolCalls: [
              {
                toolCallId: 'server-call-id',
                toolName: 'serverTool',
                input: {},
                providerExecuted: false,
              } as ParsedToolCall,
              {
                toolCallId: 'client-call-id',
                toolName: 'clientTool',
                input: { prompt: 'confirm action' },
                providerExecuted: false,
              } as ParsedToolCall,
            ],
            messages: mockMessages,
          },
        }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      const result = await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
      });

      // Server tool should have been executed
      expect(localExecuteFn).toHaveBeenCalledTimes(1);

      // Loop should have stopped
      expect(mockIterator.next).toHaveBeenCalledTimes(1);

      // toolCalls should contain ALL tool calls from the step
      expect(result.toolCalls).toHaveLength(2);
      expect(result.toolCalls[0]).toMatchObject({
        type: 'tool-call',
        toolCallId: 'server-call-id',
        toolName: 'serverTool',
      });
      expect(result.toolCalls[1]).toMatchObject({
        type: 'tool-call',
        toolCallId: 'client-call-id',
        toolName: 'clientTool',
        input: { prompt: 'confirm action' },
      });

      // toolResults should only contain the server-executed tool
      expect(result.toolResults).toHaveLength(1);
      expect(result.toolResults[0]).toMatchObject({
        type: 'tool-result',
        toolCallId: 'server-call-id',
        toolName: 'serverTool',
        output: localToolResult,
      });

      // Consumer can find unresolved calls by diffing (standard AI SDK pattern)
      const unresolvedCalls = result.toolCalls.filter(
        tc => !result.toolResults.some(tr => tr.toolCallId === tc.toolCallId),
      );
      expect(unresolvedCalls).toHaveLength(1);
      expect(unresolvedCalls[0].toolName).toBe('clientTool');

      // Messages should include the conversation (from iterMessages) and
      // a tool role message with the resolved server tool result
      expect(result.messages).toBe(mockMessages);
    });

    it('should call onFinish when stopping for client-side tools', async () => {
      const onFinish = vi.fn();
      const tools: ToolSet = {
        askUser: {
          description: 'Ask the user a question',
          inputSchema: z.object({ question: z.string() }),
        },
      };

      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'test' }] },
      ];

      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({
          done: false,
          value: {
            toolCalls: [
              {
                toolCallId: 'ask-id',
                toolName: 'askUser',
                input: '{"question":"confirm?"}',
                providerExecuted: false,
              } as LanguageModelV4ToolCall,
            ],
            messages: mockMessages,
          },
        }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
        onFinish,
      });

      // onFinish should have been called
      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          steps: expect.any(Array),
          messages: expect.any(Array),
        }),
      );
    });

    it('should have empty toolCalls when all tools complete normally', async () => {
      const tools: ToolSet = {
        serverTool: {
          description: 'A server tool',
          inputSchema: z.object({}),
          execute: vi.fn().mockResolvedValue('result'),
        },
      };

      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'test' }] },
      ];

      // Step 1: tool call (executed), Step 2: text completion (no tools)
      const mockIterator = {
        next: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [
                {
                  toolCallId: 'server-call-id',
                  toolName: 'serverTool',
                  input: '{}',
                  providerExecuted: false,
                } as LanguageModelV4ToolCall,
              ],
              messages: mockMessages,
            },
          })
          // Second step: no tool calls (text completion)
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [],
              messages: mockMessages,
            },
          })
          .mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      const result = await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
      });

      // Normal completion ends with text step - toolCalls/toolResults are empty
      // (they represent the LAST step, which had no tool calls)
      expect(result.toolCalls).toHaveLength(0);
      expect(result.toolResults).toHaveLength(0);
    });
  });

  describe('prepareStep callback', () => {
    it('should pass prepareStep callback to streamTextIterator', async () => {
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      const prepareStep: PrepareStepCallback = vi.fn().mockReturnValue({});

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
        prepareStep,
      });

      // Verify streamTextIterator was called with prepareStep
      expect(streamTextIterator).toHaveBeenCalledWith(
        expect.objectContaining({
          prepareStep,
        }),
      );
    });

    it('should allow prepareStep to modify messages', async () => {
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      const injectedMessage = {
        role: 'user' as const,
        content: [{ type: 'text' as const, text: 'injected message' }],
      };

      const prepareStep: PrepareStepCallback = ({ messages }) => {
        return {
          messages: [...messages, injectedMessage],
        };
      };

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
        prepareStep,
      });

      // Verify prepareStep was passed to the iterator
      expect(streamTextIterator).toHaveBeenCalledWith(
        expect.objectContaining({
          prepareStep: expect.any(Function),
        }),
      );
    });

    it('should allow prepareStep to change model dynamically', async () => {
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      const prepareStep: PrepareStepCallback = ({ stepNumber }) => {
        // Switch to a different model after step 0
        if (stepNumber > 0) {
          return {
            model: 'anthropic/claude-sonnet-4.5',
          };
        }
        return {};
      };

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
        prepareStep,
      });

      // Verify prepareStep was passed to the iterator
      expect(streamTextIterator).toHaveBeenCalledWith(
        expect.objectContaining({
          prepareStep: expect.any(Function),
        }),
      );
    });

    it('should provide step information to prepareStep callback', async () => {
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      const prepareStepCalls: Array<{
        model: unknown;
        stepNumber: number;
        steps: unknown[];
        messages: LanguageModelV4Prompt;
      }> = [];

      const prepareStep: PrepareStepCallback = info => {
        prepareStepCalls.push({
          model: info.model,
          stepNumber: info.stepNumber,
          steps: info.steps,
          messages: info.messages,
        });
        return {};
      };

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
        prepareStep,
      });

      // Verify prepareStep was passed and the function captures expected params
      expect(streamTextIterator).toHaveBeenCalledWith(
        expect.objectContaining({
          prepareStep: expect.any(Function),
        }),
      );
    });
  });

  describe('tool execution with messages', () => {
    it('should pass conversation messages to tool execute function', async () => {
      // Track what messages were passed to the tool
      let receivedMessages: unknown;
      let receivedToolCallId: string | undefined;

      const tools: ToolSet = {
        testTool: {
          description: 'A test tool',
          inputSchema: z.object({ query: z.string() }),
          execute: async (_input, options) => {
            receivedMessages = options.messages;
            receivedToolCallId = options.toolCallId;
            return { result: 'success' };
          },
        },
      };

      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      // Mock conversation messages that would be accumulated by the iterator
      const conversationMessages: LanguageModelV4Prompt = [
        {
          role: 'user',
          content: [{ type: 'text', text: 'What is the weather?' }],
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'test-call-id',
              toolName: 'testTool',
              input: { query: 'weather' },
            },
          ],
        },
      ];

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [
                {
                  toolCallId: 'test-call-id',
                  toolName: 'testTool',
                  input: '{"query":"weather"}',
                } as LanguageModelV4ToolCall,
              ],
              messages: conversationMessages,
            },
          })
          .mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'What is the weather?' }],
        writable: mockWritable,
      });

      // Verify that messages were passed to the tool
      expect(receivedToolCallId).toBe('test-call-id');
      expect(receivedMessages).toBeDefined();
      expect(Array.isArray(receivedMessages)).toBe(true);
      expect(receivedMessages).toEqual(conversationMessages);
    });

    it('should pass messages to multiple tools in parallel execution', async () => {
      // Track messages received by each tool
      const receivedByTools: Record<string, unknown> = {};

      const tools: ToolSet = {
        weatherTool: {
          description: 'Get weather',
          inputSchema: z.object({ city: z.string() }),
          execute: async (_input, options) => {
            receivedByTools['weatherTool'] = options.messages;
            return { temp: 72 };
          },
        },
        newsTool: {
          description: 'Get news',
          inputSchema: z.object({ topic: z.string() }),
          execute: async (_input, options) => {
            receivedByTools['newsTool'] = options.messages;
            return { headlines: ['News 1'] };
          },
        },
      };

      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const conversationMessages: LanguageModelV4Prompt = [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Weather and news please' }],
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'weather-call',
              toolName: 'weatherTool',
              input: { city: 'NYC' },
            },
            {
              type: 'tool-call',
              toolCallId: 'news-call',
              toolName: 'newsTool',
              input: { topic: 'tech' },
            },
          ],
        },
      ];

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [
                {
                  toolCallId: 'weather-call',
                  toolName: 'weatherTool',
                  input: '{"city":"NYC"}',
                } as LanguageModelV4ToolCall,
                {
                  toolCallId: 'news-call',
                  toolName: 'newsTool',
                  input: '{"topic":"tech"}',
                } as LanguageModelV4ToolCall,
              ],
              messages: conversationMessages,
            },
          })
          .mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'Weather and news please' }],
        writable: mockWritable,
      });

      // Both tools should have received the same conversation messages
      expect(receivedByTools['weatherTool']).toEqual(conversationMessages);
      expect(receivedByTools['newsTool']).toEqual(conversationMessages);
    });

    it('should pass updated messages on subsequent tool call rounds', async () => {
      // Track messages received in each round
      const messagesPerRound: unknown[] = [];

      const tools: ToolSet = {
        searchTool: {
          description: 'Search for info',
          inputSchema: z.object({ query: z.string() }),
          execute: async (_input, options) => {
            messagesPerRound.push(options.messages);
            return { found: true };
          },
        },
      };

      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      // First round messages
      const firstRoundMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'Search for cats' }] },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'search-1',
              toolName: 'searchTool',
              input: { query: 'cats' },
            },
          ],
        },
      ];

      // Second round messages (includes first tool result)
      const secondRoundMessages: LanguageModelV4Prompt = [
        ...firstRoundMessages,
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'search-1',
              toolName: 'searchTool',
              output: { type: 'text', value: '{"found":true}' },
            },
          ],
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'search-2',
              toolName: 'searchTool',
              input: { query: 'dogs' },
            },
          ],
        },
      ];

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi
          .fn()
          // First tool call round
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [
                {
                  toolCallId: 'search-1',
                  toolName: 'searchTool',
                  input: '{"query":"cats"}',
                } as LanguageModelV4ToolCall,
              ],
              messages: firstRoundMessages,
            },
          })
          // Second tool call round
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [
                {
                  toolCallId: 'search-2',
                  toolName: 'searchTool',
                  input: '{"query":"dogs"}',
                } as LanguageModelV4ToolCall,
              ],
              messages: secondRoundMessages,
            },
          })
          .mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'Search for cats' }],
        writable: mockWritable,
      });

      // Verify messages grow with each round
      expect(messagesPerRound).toHaveLength(2);
      expect(messagesPerRound[0]).toEqual(firstRoundMessages);
      expect(messagesPerRound[1]).toEqual(secondRoundMessages);
      // Second round should have more messages than first
      expect((messagesPerRound[1] as unknown[]).length).toBeGreaterThan(
        (messagesPerRound[0] as unknown[]).length,
      );
    });
  });

  describe('generation settings', () => {
    it('should pass generation settings from constructor to streamTextIterator', async () => {
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
        temperature: 0.7,
        maxOutputTokens: 1000,
        topP: 0.9,
        seed: 42,
        reasoning: 'low',
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
      });

      expect(streamTextIterator).toHaveBeenCalledWith(
        expect.objectContaining({
          generationSettings: expect.objectContaining({
            temperature: 0.7,
            maxOutputTokens: 1000,
            topP: 0.9,
            seed: 42,
            reasoning: 'low',
          }),
        }),
      );
    });

    it('should allow stream options to override constructor generation settings', async () => {
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
        temperature: 0.7,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
        temperature: 0.3, // Override
        maxOutputTokens: 500, // New setting
        reasoning: 'none',
      });

      expect(streamTextIterator).toHaveBeenCalledWith(
        expect.objectContaining({
          generationSettings: expect.objectContaining({
            temperature: 0.3,
            maxOutputTokens: 500,
            reasoning: 'none',
          }),
        }),
      );
    });
  });

  describe('toolChoice', () => {
    it('should pass toolChoice from constructor to streamTextIterator', async () => {
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
        toolChoice: 'required',
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
      });

      expect(streamTextIterator).toHaveBeenCalledWith(
        expect.objectContaining({
          toolChoice: 'required',
        }),
      );
    });

    it('should allow stream options to override constructor toolChoice', async () => {
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
        toolChoice: 'auto',
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
        toolChoice: 'none',
      });

      expect(streamTextIterator).toHaveBeenCalledWith(
        expect.objectContaining({
          toolChoice: 'none',
        }),
      );
    });
  });

  describe('activeTools', () => {
    it('should filter tools when activeTools is specified', async () => {
      const tools: ToolSet = {
        tool1: {
          description: 'Tool 1',
          inputSchema: z.object({}),
          execute: async () => ({}),
        },
        tool2: {
          description: 'Tool 2',
          inputSchema: z.object({}),
          execute: async () => ({}),
        },
        tool3: {
          description: 'Tool 3',
          inputSchema: z.object({}),
          execute: async () => ({}),
        },
      };

      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      // Clear previous mock calls
      vi.mocked(streamTextIterator).mockClear();

      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
        activeTools: ['tool1', 'tool3'],
      });

      // Verify only active tools are passed (get the most recent call)
      const calls = vi.mocked(streamTextIterator).mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(Object.keys(lastCall.tools).sort()).toEqual(['tool1', 'tool3']);
    });
  });

  describe('constructor-level defaults for stream-only parameters', () => {
    it('should use constructor stopWhen when not specified in stream()', async () => {
      const mockModel = createMockModel();
      const stopWhenFn = vi.fn(() => false);

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
        stopWhen: stopWhenFn as any,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      vi.mocked(streamTextIterator).mockClear();
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
      });

      const calls = vi.mocked(streamTextIterator).mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.stopConditions).toBe(stopWhenFn);
    });

    it('should allow stream options to override constructor stopWhen', async () => {
      const mockModel = createMockModel();
      const constructorStopWhen = vi.fn(() => false);
      const streamStopWhen = vi.fn(() => true);

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
        stopWhen: constructorStopWhen as any,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      vi.mocked(streamTextIterator).mockClear();
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
        stopWhen: streamStopWhen as any,
      });

      const calls = vi.mocked(streamTextIterator).mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.stopConditions).toBe(streamStopWhen);
    });

    it('should use constructor activeTools when not specified in stream()', async () => {
      const tools: ToolSet = {
        tool1: {
          description: 'Tool 1',
          inputSchema: z.object({}),
          execute: async () => ({}),
        },
        tool2: {
          description: 'Tool 2',
          inputSchema: z.object({}),
          execute: async () => ({}),
        },
      };

      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools,
        activeTools: ['tool1'],
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      vi.mocked(streamTextIterator).mockClear();
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
      });

      const calls = vi.mocked(streamTextIterator).mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(Object.keys(lastCall.tools)).toEqual(['tool1']);
    });

    it('should use constructor repairToolCall when not specified in stream()', async () => {
      const mockModel = createMockModel();
      const repairFn: ToolCallRepairFunction<ToolSet> = vi.fn();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
        repairToolCall: repairFn,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      vi.mocked(streamTextIterator).mockClear();
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
      });

      const calls = vi.mocked(streamTextIterator).mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.repairToolCall).toBe(repairFn);
    });
  });

  describe('callbacks', () => {
    it('should pass onError callback to streamTextIterator', async () => {
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      const onError = vi.fn();

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
        onError,
      });

      expect(streamTextIterator).toHaveBeenCalledWith(
        expect.objectContaining({
          onError,
        }),
      );
    });

    it('should convert tool execution error to error-text result instead of failing stream', async () => {
      const errorMessage = 'Tool execution failed';
      const tools: ToolSet = {
        failingTool: {
          description: 'A tool that fails',
          inputSchema: z.object({}),
          execute: async () => {
            throw new Error(errorMessage);
          },
        },
      };

      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const mockMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'test' }] },
      ];

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [
                {
                  toolCallId: 'test-call-id',
                  toolName: 'failingTool',
                  input: '{}',
                } as LanguageModelV4ToolCall,
              ],
              messages: mockMessages,
            },
          })
          .mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      // Tool errors should be handled gracefully, not reject the stream
      await expect(
        agent.stream({
          messages: [{ role: 'user', content: 'test' }],
          writable: mockWritable,
        }),
      ).resolves.not.toThrow();

      // Verify the error was sent back as an error-text tool result
      expect(mockIterator.next).toHaveBeenCalledTimes(2);
      const toolResultsCall = mockIterator.next.mock.calls[1][0];
      expect(toolResultsCall).toBeDefined();
      expect(toolResultsCall).toHaveLength(1);
      expect(toolResultsCall[0]).toMatchObject({
        type: 'tool-result',
        toolCallId: 'test-call-id',
        toolName: 'failingTool',
        output: {
          type: 'error-text',
          value: `Error: ${errorMessage}`,
        },
      });
    });

    it('should call onFinish with steps and messages when streaming completes', async () => {
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockStep: StepResult<any, any> = {
        content: [{ type: 'text', text: 'Hello' }],
        text: 'Hello',
        reasoningText: undefined,
        reasoning: [],
        files: [],
        sources: [],
        toolCalls: [],
        toolResults: [],
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        request: {},
        response: {
          id: 'test-id',
          modelId: 'test-model',
          timestamp: new Date(),
        },
        warnings: [],
        // We're missing some properties that aren't relevant for the test
      } as unknown as StepResult<any, any>;
      const mockMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'test' }] },
      ];
      const mockIterator = {
        next: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [],
              messages: mockMessages,
              step: mockStep,
            },
          })
          .mockResolvedValueOnce({ done: true, value: mockMessages }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      const onFinish = vi.fn();

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
        onFinish,
      });

      expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          steps: expect.any(Array),
          messages: expect.any(Array),
          runtimeContext: expect.any(Object),
          toolsContext: expect.any(Object),
        }),
      );
    });

    it('should call onAbort when abort signal is already aborted', async () => {
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      const onAbort = vi.fn();
      const abortController = new AbortController();
      abortController.abort();

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
        abortSignal: abortController.signal,
        onAbort,
      });

      expect(onAbort).toHaveBeenCalledWith({ steps: [] });
    });

    it('should pass stepNumber to onToolExecutionStart and use discriminated union in onToolExecutionEnd', async () => {
      const tools: ToolSet = {
        testTool: {
          description: 'A test tool',
          inputSchema: z.object({}),
          execute: async () => ({ result: 'ok' }),
        },
      };

      const mockModel = createMockModel();

      const onToolExecutionStart = vi.fn();
      const onToolExecutionEnd = vi.fn();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools,
        onToolExecutionStart: onToolExecutionStart,
        onToolExecutionEnd: onToolExecutionEnd,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const mockMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'test' }] },
      ];

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [
                {
                  toolCallId: 'call-1',
                  toolName: 'testTool',
                  input: '{}',
                } as LanguageModelV4ToolCall,
              ],
              messages: mockMessages,
            },
          })
          .mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
      });

      // Verify onToolExecutionStart includes stepNumber
      expect(onToolExecutionStart).toHaveBeenCalledWith(
        expect.objectContaining({
          stepNumber: 0,
          toolCall: expect.objectContaining({
            toolCallId: 'call-1',
            toolName: 'testTool',
          }),
        }),
      );

      // Verify onToolExecutionEnd uses discriminated union with success: true
      expect(onToolExecutionEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          stepNumber: 0,
          success: true,
          output: { result: 'ok' },
          durationMs: expect.any(Number),
          toolCall: expect.objectContaining({
            toolCallId: 'call-1',
            toolName: 'testTool',
          }),
        }),
      );
    });

    it('should pass success: false in onToolExecutionEnd when tool errors', async () => {
      const tools: ToolSet = {
        failTool: {
          description: 'A tool that fails',
          inputSchema: z.object({}),
          execute: async () => {
            throw new Error('tool failed');
          },
        },
      };

      const mockModel = createMockModel();

      const onToolExecutionEnd = vi.fn();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools,
        onToolExecutionEnd: onToolExecutionEnd,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const mockMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'test' }] },
      ];

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [
                {
                  toolCallId: 'call-1',
                  toolName: 'failTool',
                  input: '{}',
                } as LanguageModelV4ToolCall,
              ],
              messages: mockMessages,
            },
          })
          .mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
      });

      // Verify onToolExecutionEnd uses discriminated union with success: false
      expect(onToolExecutionEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          stepNumber: 0,
          success: false,
          error: 'Error: tool failed',
          durationMs: expect.any(Number),
        }),
      );
    });

    it('should pass steps to onStepStart callback', async () => {
      const mockModel = createMockModel();

      const onStepStart = vi.fn();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
        experimental_onStepStart: onStepStart,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
      });

      // Verify onStepStart is passed to streamTextIterator (it will be called internally)
      expect(streamTextIterator).toHaveBeenCalledWith(
        expect.objectContaining({
          onStepStart: expect.any(Function),
        }),
      );
    });
  });

  describe('runtimeContext and toolsContext', () => {
    async function mockIteratorWithToolCall(toolName = 'weather') {
      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const mockMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'test' }] },
      ];

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      vi.mocked(streamTextIterator).mockReturnValue({
        next: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [
                {
                  toolCallId: 'call-1',
                  toolName,
                  input: '{}',
                } as LanguageModelV4ToolCall,
              ],
              messages: mockMessages,
            },
          })
          .mockResolvedValueOnce({ done: true, value: [] }),
      } as unknown as MockIterator);

      return mockWritable;
    }

    it('should pass per-tool toolsContext entry as the tool execute context', async () => {
      let receivedContext: unknown;

      const tools: ToolSet = {
        weather: {
          description: 'Get weather',
          inputSchema: z.object({}),
          execute: async (_input, options) => {
            receivedContext = options.context;
            return { result: 'ok' };
          },
        },
      };

      const agent = new WorkflowAgent({
        model: createMockModel(),
        tools,
      });

      const mockWritable = await mockIteratorWithToolCall();

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
        toolsContext: {
          weather: { weatherApiKey: 'secret-key', defaultUnit: 'celsius' },
        },
      });

      expect(receivedContext).toEqual({
        weatherApiKey: 'secret-key',
        defaultUnit: 'celsius',
      });
    });

    it('should pass undefined context when no toolsContext entry exists', async () => {
      let receivedContext: unknown = 'sentinel';

      const tools: ToolSet = {
        weather: {
          description: 'Get weather',
          inputSchema: z.object({}),
          execute: async (_input, options) => {
            receivedContext = options.context;
            return { result: 'ok' };
          },
        },
      };

      const agent = new WorkflowAgent({
        model: createMockModel(),
        tools,
      });

      const mockWritable = await mockIteratorWithToolCall();

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
      });

      expect(receivedContext).toBeUndefined();
    });

    it.each([
      ['invalid', { weather: {} as { apiKey: string } }],
      ['missing', undefined],
    ])(
      'should validate %s per-tool context against contextSchema',
      async (_case, toolsContext) => {
        const tools: ToolSet = {
          weather: {
            description: 'Get weather',
            inputSchema: z.object({}),
            contextSchema: z.object({
              apiKey: z.string(),
            }),
            execute: async () => ({ result: 'ok' }),
          },
        };

        const agent = new WorkflowAgent({
          model: createMockModel(),
          tools,
        });

        const mockWritable = await mockIteratorWithToolCall();

        await expect(
          agent.stream({
            messages: [{ role: 'user', content: 'test' }],
            writable: mockWritable,
            ...(toolsContext !== undefined && { toolsContext }),
          }),
        ).rejects.toThrow();
      },
    );

    it('should pass runtimeContext to onFinish', async () => {
      const onFinish = vi.fn();
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
        onFinish,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const mockStep: StepResult<any, any> = {
        content: [{ type: 'text', text: 'Hello' }],
        text: 'Hello',
        reasoningText: undefined,
        reasoning: [],
        files: [],
        sources: [],
        toolCalls: [],
        toolResults: [],
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        request: {},
        response: {
          id: 'test-id',
          modelId: 'test-model',
          timestamp: new Date(),
        },
        warnings: [],
      } as unknown as StepResult<any, any>;

      const mockMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'test' }] },
      ];

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [],
              messages: mockMessages,
              step: mockStep,
              runtimeContext: { tenantId: 'tenant_123' },
              toolsContext: { weather: { unit: 'fahrenheit' } },
            },
          })
          .mockResolvedValueOnce({ done: true, value: mockMessages }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
        runtimeContext: { tenantId: 'tenant_123' },
        toolsContext: { weather: { unit: 'fahrenheit' } },
      });

      expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeContext: { tenantId: 'tenant_123' },
          toolsContext: { weather: { unit: 'fahrenheit' } },
        }),
      );
    });
  });

  describe('stream result', () => {
    it('should return messages and steps in result', async () => {
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const mockStep: StepResult<any, any> = {
        content: [{ type: 'text', text: 'Hello' }],
        text: 'Hello',
        reasoningText: undefined,
        reasoning: [],
        files: [],
        sources: [],
        toolCalls: [],
        toolResults: [],
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        request: {},
        response: {
          id: 'test-id',
          modelId: 'test-model',
          timestamp: new Date(),
        },
        warnings: [],
        // We're missing some properties that aren't relevant for the test
      } as unknown as StepResult<any, any>;
      const finalMessages: LanguageModelV4Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'test' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'Hello' }] },
      ];

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: {
              toolCalls: [],
              messages: finalMessages,
              step: mockStep,
            },
          })
          .mockResolvedValueOnce({ done: true, value: finalMessages }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      const result = await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
      });

      expect(result.messages).toBeDefined();
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0]).toEqual(mockStep);
    });
  });

  describe('prompt parameter', () => {
    it('should accept a string prompt instead of messages', async () => {
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        prompt: 'What is the weather?',
        writable: mockWritable,
      });

      // Verify streamTextIterator was called (standardizePrompt converts string prompt to messages)
      expect(streamTextIterator).toHaveBeenCalled();
    });

    it('should accept an array of messages as prompt', async () => {
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        prompt: [{ role: 'user', content: 'What is the weather?' }],
        writable: mockWritable,
      });

      expect(streamTextIterator).toHaveBeenCalled();
    });
  });

  describe('allowSystemInMessages', () => {
    const messagesWithSystem = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'What is the weather?' },
    ] as any;

    function mockIteratorOnce() {
      return import('./stream-text-iterator.js').then(
        ({ streamTextIterator }) => {
          const mockIterator = {
            next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
          };
          vi.mocked(streamTextIterator).mockReturnValue(
            mockIterator as unknown as MockIterator,
          );
          return streamTextIterator;
        },
      );
    }

    it('should reject system messages in messages by default', async () => {
      const agent = new WorkflowAgent({ model: createMockModel(), tools: {} });
      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });
      await mockIteratorOnce();

      await expect(
        agent.stream({ messages: messagesWithSystem, writable: mockWritable }),
      ).rejects.toThrow(InvalidPromptError);
    });

    it('should reject system messages in prompt by default', async () => {
      const agent = new WorkflowAgent({ model: createMockModel(), tools: {} });
      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });
      await mockIteratorOnce();

      await expect(
        agent.stream({ prompt: messagesWithSystem, writable: mockWritable }),
      ).rejects.toThrow(InvalidPromptError);
    });

    it('should allow system messages when allowSystemInMessages is true', async () => {
      const agent = new WorkflowAgent({
        model: createMockModel(),
        tools: {},
        allowSystemInMessages: true,
      });
      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });
      const streamTextIterator = await mockIteratorOnce();

      await agent.stream({
        messages: messagesWithSystem,
        writable: mockWritable,
      });

      expect(streamTextIterator).toHaveBeenCalled();
    });
  });

  describe('tool call repair', () => {
    it('should pass repairToolCall through to streamTextIterator', async () => {
      const repairFn: ToolCallRepairFunction<ToolSet> = vi.fn();

      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
        repairToolCall: repairFn,
      });

      // Verify repairToolCall is passed through to streamTextIterator
      // (streamModelCall inside doStreamStep will use it for tool call repair)
      expect(streamTextIterator).toHaveBeenCalledWith(
        expect.objectContaining({
          repairToolCall: repairFn,
        }),
      );
    });
  });

  describe('includeRawChunks', () => {
    it('should pass includeRawChunks to streamTextIterator', async () => {
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
        includeRawChunks: true,
      });

      expect(streamTextIterator).toHaveBeenCalledWith(
        expect.objectContaining({
          includeRawChunks: true,
        }),
      );
    });
  });

  describe('telemetry', () => {
    it('should pass telemetry settings from constructor to streamTextIterator', async () => {
      const mockModel = createMockModel();

      const TelemetryOptions = {
        isEnabled: true,
        functionId: 'test-agent',
        recordInputs: false,
      };

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
        telemetry: TelemetryOptions,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
      });

      expect(streamTextIterator).toHaveBeenCalledWith(
        expect.objectContaining({
          telemetry: TelemetryOptions,
        }),
      );
    });

    it('should allow stream options to override constructor telemetry', async () => {
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
        telemetry: { functionId: 'constructor-id' },
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      const streamTelemetry = { functionId: 'stream-id', isEnabled: false };

      await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
        telemetry: streamTelemetry,
      });

      expect(streamTextIterator).toHaveBeenCalledWith(
        expect.objectContaining({
          telemetry: streamTelemetry,
        }),
      );
    });
  });

  /* collectUIMessages tests removed — WorkflowAgent no longer handles UIMessageChunks
    it('should return undefined uiMessages when collectUIMessages is false', async () => {
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      const result = await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
        collectUIMessages: false,
      });

      expect(result.uiMessages).toBeUndefined();
    });

    it('should return undefined uiMessages when collectUIMessages is not set', async () => {
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      const result = await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
      });

      expect(result.uiMessages).toBeUndefined();
    });

    it('should pass collectUIChunks to streamTextIterator when collectUIMessages is true', async () => {
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      let capturedCollectUIChunks: boolean | undefined;
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockImplementation(opts => {
        capturedCollectUIChunks = opts.collectUIChunks;
        return mockIterator as unknown as MockIterator;
      });

      const result = await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
        collectUIMessages: true,
      });

      // When collectUIMessages is true, collectUIChunks should be passed to streamTextIterator
      expect(capturedCollectUIChunks).toBe(true);

      // uiMessages should be defined (even if empty, since we're mocking)
      expect(result.uiMessages).toBeDefined();
      expect(Array.isArray(result.uiMessages)).toBe(true);
    });

    it('should work correctly when collectUIMessages is true and sendFinish is false', async () => {
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
      });

      const writtenChunks: unknown[] = [];
      const closeFn = vi.fn();
      const mockWritable = new WritableStream({
        write: chunk => {
          writtenChunks.push(chunk);
        },
        close: closeFn,
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      const result = await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
        collectUIMessages: true,
        sendFinish: false,
      });

      // uiMessages should still be defined even when sendFinish is false
      expect(result.uiMessages).toBeDefined();
      expect(Array.isArray(result.uiMessages)).toBe(true);

      // The original writable should have been closed (since preventClose defaults to false)
      expect(closeFn).toHaveBeenCalled();

      // No finish chunk should have been written to the client
      expect(
        writtenChunks.find((c: any) => c.type === 'finish'),
      ).toBeUndefined();
    });

    it('should not write finish chunk but still return uiMessages when sendFinish is false', async () => {
      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools: {},
      });

      const writtenChunks: unknown[] = [];
      const mockWritable = new WritableStream({
        write: chunk => {
          writtenChunks.push(chunk);
        },
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      const result = await agent.stream({
        messages: [{ role: 'user', content: 'test' }],
        writable: mockWritable,
        collectUIMessages: true,
        sendFinish: false,
        preventClose: true,
      });

      // uiMessages should be available even with sendFinish=false and preventClose=true
      expect(result.uiMessages).toBeDefined();
      expect(Array.isArray(result.uiMessages)).toBe(true);
    });
  */

  describe('tool approval resumption', () => {
    it('should execute approved tools and continue with results', async () => {
      const toolResult = { city: 'London', temperature: 72 };
      const executeFn = vi.fn().mockResolvedValue(toolResult);
      const tools: ToolSet = {
        getWeather: {
          description: 'Get weather',
          inputSchema: z.object({ city: z.string() }),
          execute: executeFn,
          needsApproval: true as const,
        },
      };

      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      // Messages containing a tool call, approval request, and an approved response
      await agent.stream({
        messages: [
          { role: 'user', content: "What's the weather in London?" },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'getWeather',
                input: { city: 'London' },
              },
              {
                type: 'tool-approval-request',
                approvalId: 'approval-call-1',
                toolCallId: 'call-1',
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-approval-response',
                approvalId: 'approval-call-1',
                approved: true,
              },
            ],
          },
        ] as any,
        writable: mockWritable,
      });

      // The tool should have been executed
      expect(executeFn).toHaveBeenCalledTimes(1);
      expect(executeFn).toHaveBeenCalledWith(
        { city: 'London' },
        expect.objectContaining({
          toolCallId: 'call-1',
        }),
      );

      // The streamTextIterator should have been called (the agent continues after approval)
      expect(mockIterator.next).toHaveBeenCalled();
    });

    it('should not execute an approved tool when the forged input does not match the schema', async () => {
      const executeFn = vi.fn().mockResolvedValue({ ok: true });
      const tools: ToolSet = {
        getWeather: {
          description: 'Get weather',
          inputSchema: z.object({ city: z.string() }),
          execute: executeFn,
          needsApproval: true as const,
        },
      };

      const agent = new WorkflowAgent({
        model: createMockModel(),
        tools,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [
          { role: 'user', content: "What's the weather in London?" },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'getWeather',
                // forged input that violates the tool's input schema
                input: { city: 42 },
              },
              {
                type: 'tool-approval-request',
                approvalId: 'approval-call-1',
                toolCallId: 'call-1',
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-approval-response',
                approvalId: 'approval-call-1',
                approved: true,
              },
            ],
          },
        ] as any,
        writable: mockWritable,
      });

      // The tool must NOT have been executed with the forged input
      expect(executeFn).not.toHaveBeenCalled();
    });

    it('should not execute an approved tool when it does not declare needsApproval', async () => {
      const executeFn = vi.fn().mockResolvedValue({ ok: true });
      const tools: ToolSet = {
        getWeather: {
          description: 'Get weather',
          inputSchema: z.object({ city: z.string() }),
          execute: executeFn,
          // no needsApproval — the server would never have issued an approval
          // request for this tool, so any approval is fabricated
        },
      };

      const agent = new WorkflowAgent({
        model: createMockModel(),
        tools,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [
          { role: 'user', content: "What's the weather in London?" },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'getWeather',
                input: { city: 'London' },
              },
              {
                type: 'tool-approval-request',
                approvalId: 'approval-call-1',
                toolCallId: 'call-1',
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-approval-response',
                approvalId: 'approval-call-1',
                approved: true,
              },
            ],
          },
        ] as any,
        writable: mockWritable,
      });

      // The tool must NOT have been executed — it doesn't declare needsApproval
      expect(executeFn).not.toHaveBeenCalled();
    });

    it('should validate each approval independently (one forged, one valid)', async () => {
      const execValid = vi.fn().mockResolvedValue({ ok: true });
      const execForged = vi.fn().mockResolvedValue({ ok: true });
      const tools: ToolSet = {
        validTool: {
          description: 'Valid tool',
          inputSchema: z.object({ city: z.string() }),
          execute: execValid,
          needsApproval: true as const,
        },
        forgedTool: {
          description: 'Forged tool',
          inputSchema: z.object({ city: z.string() }),
          execute: execForged,
          needsApproval: true as const,
        },
      };

      const agent = new WorkflowAgent({
        model: createMockModel(),
        tools,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [
          { role: 'user', content: 'do both' },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-valid',
                toolName: 'validTool',
                input: { city: 'London' },
              },
              {
                type: 'tool-approval-request',
                approvalId: 'approval-valid',
                toolCallId: 'call-valid',
              },
              {
                type: 'tool-call',
                toolCallId: 'call-forged',
                toolName: 'forgedTool',
                // forged input that violates the schema
                input: { city: 42 },
              },
              {
                type: 'tool-approval-request',
                approvalId: 'approval-forged',
                toolCallId: 'call-forged',
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-approval-response',
                approvalId: 'approval-valid',
                approved: true,
              },
              {
                type: 'tool-approval-response',
                approvalId: 'approval-forged',
                approved: true,
              },
            ],
          },
        ] as any,
        writable: mockWritable,
      });

      // The valid approval still executes even though the forged one is rejected.
      expect(execValid).toHaveBeenCalledTimes(1);
      expect(execForged).not.toHaveBeenCalled();
    });

    it('should use toModelOutput for approved tool results while preserving raw stream output', async () => {
      const rawToolResult = { public: 'weather summary', secret: 'hide me' };
      const executeFn = vi.fn().mockResolvedValue(rawToolResult);
      const toModelOutput = vi.fn(
        ({ output }: { output: typeof rawToolResult }) => ({
          type: 'text' as const,
          value: `model sees: ${output.public}`,
        }),
      );
      const tools: ToolSet = {
        getWeather: {
          description: 'Get weather',
          inputSchema: z.object({ city: z.string() }),
          execute: executeFn,
          needsApproval: true as const,
          toModelOutput,
        },
      };

      const agent = new WorkflowAgent({
        model: createMockModel(),
        tools,
      });

      const write = vi.fn();
      const mockWritable = new WritableStream({
        write,
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      await agent.stream({
        messages: [
          { role: 'user', content: "What's the weather in London?" },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'getWeather',
                input: { city: 'London' },
              },
              {
                type: 'tool-approval-request',
                approvalId: 'approval-call-1',
                toolCallId: 'call-1',
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-approval-response',
                approvalId: 'approval-call-1',
                approved: true,
              },
            ],
          },
        ] as any,
        writable: mockWritable,
      });

      expect(toModelOutput).toHaveBeenCalledWith({
        toolCallId: 'call-1',
        input: { city: 'London' },
        output: rawToolResult,
      });

      const iteratorArgs = vi
        .mocked(streamTextIterator)
        .mock.calls.at(-1)?.[0] as any;
      const toolMessage = iteratorArgs.prompt.find(
        (message: any) =>
          message.role === 'tool' &&
          message.content.some((part: any) => part.toolCallId === 'call-1'),
      );
      expect(toolMessage.content[0]).toMatchObject({
        type: 'tool-result',
        toolCallId: 'call-1',
        toolName: 'getWeather',
        output: {
          type: 'text',
          value: 'model sees: weather summary',
        },
      });
      expect(write.mock.calls.map(([chunk]) => chunk)).toContainEqual(
        expect.objectContaining({
          type: 'tool-result',
          toolCallId: 'call-1',
          output: rawToolResult,
        }),
      );
    });

    it('should create denial results for denied tools and continue', async () => {
      const executeFn = vi.fn();
      const tools: ToolSet = {
        deleteFile: {
          description: 'Delete a file',
          inputSchema: z.object({ path: z.string() }),
          execute: executeFn,
          needsApproval: true as const,
        },
      };

      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      // Messages containing a tool call, approval request, and a denied response
      await agent.stream({
        messages: [
          { role: 'user', content: 'Delete /etc/passwd' },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'deleteFile',
                input: { path: '/etc/passwd' },
              },
              {
                type: 'tool-approval-request',
                approvalId: 'approval-call-1',
                toolCallId: 'call-1',
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-approval-response',
                approvalId: 'approval-call-1',
                approved: false,
                reason: 'Too dangerous',
              },
            ],
          },
        ] as any,
        writable: mockWritable,
      });

      // The tool should NOT have been executed
      expect(executeFn).not.toHaveBeenCalled();

      // The streamTextIterator should have been called (the agent continues with denial result)
      expect(mockIterator.next).toHaveBeenCalled();
    });

    it('should pass through messages without approval responses unchanged', async () => {
      const tools: ToolSet = {
        getWeather: {
          description: 'Get weather',
          inputSchema: z.object({ city: z.string() }),
          execute: async () => ({ temperature: 72 }),
        },
      };

      const mockModel = createMockModel();

      const agent = new WorkflowAgent({
        model: mockModel,
        tools,
      });

      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      // Normal messages without any approval parts
      await agent.stream({
        messages: [{ role: 'user', content: 'Hello' }],
        writable: mockWritable,
      });

      // Should proceed normally without any approval processing
      expect(mockIterator.next).toHaveBeenCalled();
    });

    // Regression for #14292: provider-executed tool approvals (e.g. MCP via
    // the Responses API) must be forwarded to the provider on resume rather
    // than silently dropped. The provider owns execution, so the approval
    // response has to survive the approval-resume cleanup and reach the model.
    function collectApprovalResponses(
      prompt: ReadonlyArray<{ role: string; content: unknown }>,
    ): Array<{ approvalId: string; approved: boolean }> {
      const responses: Array<{ approvalId: string; approved: boolean }> = [];
      for (const message of prompt) {
        if (message.role !== 'tool' || !Array.isArray(message.content)) {
          continue;
        }
        for (const part of message.content as any[]) {
          if (part.type === 'tool-approval-response') {
            responses.push({
              approvalId: part.approvalId,
              approved: part.approved,
            });
          }
        }
      }
      return responses;
    }

    it('should forward an approved provider-executed approval to the provider', async () => {
      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      // The provider-executed tool is not part of the agent's local tool set.
      const agent = new WorkflowAgent({ model: createMockModel(), tools: {} });
      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      await agent.stream({
        messages: [
          { role: 'user', content: 'Search the docs.' },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'mcp_search',
                input: { query: 'docs' },
                providerExecuted: true,
              },
              {
                type: 'tool-approval-request',
                approvalId: 'approval-call-1',
                toolCallId: 'call-1',
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-approval-response',
                approvalId: 'approval-call-1',
                approved: true,
              },
            ],
          },
        ] as any,
        writable: mockWritable,
      });

      // The agent continues, and the provider receives the approval response.
      const call = vi.mocked(streamTextIterator).mock.calls.at(-1)!;
      const prompt = (call[0] as { prompt: any[] }).prompt;
      expect(collectApprovalResponses(prompt)).toContainEqual({
        approvalId: 'approval-call-1',
        approved: true,
      });
    });

    it('should forward a denied provider-executed approval to the provider', async () => {
      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      const agent = new WorkflowAgent({ model: createMockModel(), tools: {} });
      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      await agent.stream({
        messages: [
          { role: 'user', content: 'Search the docs.' },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'mcp_search',
                input: { query: 'docs' },
                providerExecuted: true,
              },
              {
                type: 'tool-approval-request',
                approvalId: 'approval-call-1',
                toolCallId: 'call-1',
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-approval-response',
                approvalId: 'approval-call-1',
                approved: false,
              },
            ],
          },
        ] as any,
        writable: mockWritable,
      });

      const call = vi.mocked(streamTextIterator).mock.calls.at(-1)!;
      const prompt = (call[0] as { prompt: any[] }).prompt;
      expect(collectApprovalResponses(prompt)).toContainEqual({
        approvalId: 'approval-call-1',
        approved: false,
      });
    });

    it('should execute local approvals while forwarding provider-executed ones', async () => {
      const toolResult = { city: 'London', temperature: 72 };
      const executeFn = vi.fn().mockResolvedValue(toolResult);
      const tools: ToolSet = {
        getWeather: {
          description: 'Get weather',
          inputSchema: z.object({ city: z.string() }),
          execute: executeFn,
          needsApproval: true as const,
        },
      };

      const { streamTextIterator } = await import('./stream-text-iterator.js');
      const mockIterator = {
        next: vi.fn().mockResolvedValueOnce({ done: true, value: [] }),
      };
      vi.mocked(streamTextIterator).mockReturnValue(
        mockIterator as unknown as MockIterator,
      );

      const agent = new WorkflowAgent({ model: createMockModel(), tools });
      const mockWritable = new WritableStream({
        write: vi.fn(),
        close: vi.fn(),
      });

      await agent.stream({
        messages: [
          { role: 'user', content: 'Weather in London and search the docs.' },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'local-1',
                toolName: 'getWeather',
                input: { city: 'London' },
              },
              {
                type: 'tool-approval-request',
                approvalId: 'approval-local-1',
                toolCallId: 'local-1',
              },
              {
                type: 'tool-call',
                toolCallId: 'provider-1',
                toolName: 'mcp_search',
                input: { query: 'docs' },
                providerExecuted: true,
              },
              {
                type: 'tool-approval-request',
                approvalId: 'approval-provider-1',
                toolCallId: 'provider-1',
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-approval-response',
                approvalId: 'approval-local-1',
                approved: true,
              },
              {
                type: 'tool-approval-response',
                approvalId: 'approval-provider-1',
                approved: true,
              },
            ],
          },
        ] as any,
        writable: mockWritable,
      });

      // Local approval executes locally.
      expect(executeFn).toHaveBeenCalledTimes(1);
      expect(executeFn).toHaveBeenCalledWith(
        { city: 'London' },
        expect.objectContaining({ toolCallId: 'local-1' }),
      );

      // Only the provider-executed approval response is forwarded; the local
      // one is stripped and replaced by a tool result.
      const call = vi.mocked(streamTextIterator).mock.calls.at(-1)!;
      const prompt = (call[0] as { prompt: any[] }).prompt;
      const forwarded = collectApprovalResponses(prompt);
      expect(forwarded).toContainEqual({
        approvalId: 'approval-provider-1',
        approved: true,
      });
      expect(forwarded).not.toContainEqual({
        approvalId: 'approval-local-1',
        approved: true,
      });
    });
  });
});
