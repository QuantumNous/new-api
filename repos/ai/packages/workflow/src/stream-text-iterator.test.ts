/**
 * Tests for streamTextIterator
 *
 * These tests verify that providerMetadata from tool calls is correctly
 * mapped to providerOptions in the conversation prompt, which is critical
 * for providers like Gemini that require thoughtSignature to be preserved
 * across multi-turn tool calls.
 */
import type {
  LanguageModelV4Prompt,
  LanguageModelV4StreamPart,
  LanguageModelV4ToolCall,
  LanguageModelV4ToolResultPart,
} from '@ai-sdk/provider';
import type {
  Experimental_LanguageModelStreamPart,
  StepResult,
  ToolSet,
} from 'ai';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ParsedToolCall } from './do-stream-step.js';
import type { StreamTextIteratorYieldValue } from './stream-text-iterator.js';

// Mock doStreamStep
vi.mock('./do-stream-step.js', () => ({
  doStreamStep: vi.fn(),
}));

// Import after mocking
const { streamTextIterator } = await import('./stream-text-iterator.js');
const { doStreamStep } = await import('./do-stream-step.js');

/**
 * Helper to create a mock writable stream
 */
function createMockWritable(): WritableStream<
  Experimental_LanguageModelStreamPart<ToolSet>
> {
  return new WritableStream({
    write: vi.fn(),
    close: vi.fn(),
  });
}

/**
 * Helper to create a minimal step result for testing
 */
function createMockStepResult(
  overrides: Partial<StepResult<ToolSet, any>> = {},
): StepResult<ToolSet, any> {
  return {
    content: [],
    text: '',
    reasoning: [],
    reasoningText: undefined,
    files: [],
    sources: [],
    toolCalls: [],
    staticToolCalls: [],
    dynamicToolCalls: [],
    toolResults: [],
    staticToolResults: [],
    dynamicToolResults: [],
    finishReason: 'stop',
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      inputTokenDetails: {
        noCacheTokens: undefined,
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined,
      },
      outputTokenDetails: {
        textTokens: undefined,
        reasoningTokens: undefined,
      },
    },
    warnings: [],
    request: { body: '' },
    response: {
      id: 'test',
      timestamp: new Date(),
      modelId: 'test',
      messages: [],
    },
    providerMetadata: {},
    ...overrides,
  } as StepResult<ToolSet, any>;
}

const mockUsage = {
  inputTokens: 10,
  inputTokenDetails: {
    noCacheTokens: undefined,
    cacheReadTokens: undefined,
    cacheWriteTokens: undefined,
  },
  outputTokens: 5,
  outputTokenDetails: {
    textTokens: undefined,
    reasoningTokens: undefined,
  },
  totalTokens: 15,
};

function createMockFinish(
  finishReason: 'stop' | 'tool-calls' = 'stop',
  rawFinishReason: string = 'stop',
) {
  return {
    finishReason,
    rawFinishReason,
    usage: mockUsage,
  };
}

function createMockDoStreamStepResult({
  toolCalls = [] as ParsedToolCall[],
  finishReason = 'stop' as 'stop' | 'tool-calls',
  finishRaw = 'stop',
  stepOverrides = {},
}: {
  toolCalls?: ParsedToolCall[];
  finishReason?: 'stop' | 'tool-calls';
  finishRaw?: string;
  stepOverrides?: Partial<StepResult<ToolSet, any>>;
} = {}) {
  return {
    toolCalls,
    finish: createMockFinish(finishReason, finishRaw),
    step: createMockStepResult({
      finishReason,
      ...stepOverrides,
    }),
    providerExecutedToolResults: new Map(),
  };
}

describe('streamTextIterator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('providerMetadata to providerOptions mapping', () => {
    it('should preserve providerMetadata as providerOptions in tool-call messages', async () => {
      const mockWritable = createMockWritable();
      const mockModel = vi.fn();

      // Capture the conversation prompt passed to subsequent doStreamStep calls
      let capturedPrompt: LanguageModelV4Prompt | undefined;

      const toolCallWithMetadata: LanguageModelV4ToolCall = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'testTool',
        input: '{"query":"test"}',
        providerMetadata: {
          google: {
            thoughtSignature: 'sig_abc123_test_signature',
          },
        },
      };

      // First call returns tool-calls with providerMetadata
      // Second call (after tool results) should receive the updated prompt
      vi.mocked(doStreamStep)
        .mockResolvedValueOnce(
          createMockDoStreamStepResult({
            toolCalls: [toolCallWithMetadata],
            finishReason: 'tool-calls',
            finishRaw: 'tool_calls',
          }),
        )
        .mockImplementationOnce(
          async (prompt, _modelInit, _writable, _tools, _options) => {
            // Capture the prompt on the second call to verify providerOptions
            capturedPrompt = prompt;
            return createMockDoStreamStepResult();
          },
        );

      const iterator = streamTextIterator({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
        tools: {
          testTool: {
            description: 'A test tool',
            execute: async () => ({ result: 'success' }),
          },
        } as unknown as ToolSet,
        writable: mockWritable,
        model: mockModel as any,
      });

      // First iteration - get tool calls
      const firstResult = await iterator.next();
      expect(firstResult.done).toBe(false);
      const firstValue = firstResult.value as StreamTextIteratorYieldValue;
      expect(firstValue.toolCalls).toHaveLength(1);

      // Provide tool results and continue
      const toolResults: LanguageModelV4ToolResultPart[] = [
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'testTool',
          output: { type: 'text', value: '{"result":"success"}' },
        },
      ];

      // Second iteration - should trigger second doStreamStep call
      await iterator.next(toolResults);

      // Verify the captured prompt contains providerOptions
      expect(capturedPrompt).toBeDefined();

      // Find the assistant message with tool calls
      const assistantMessage = capturedPrompt?.find(
        msg => msg.role === 'assistant',
      );
      expect(assistantMessage).toBeDefined();

      // Verify the tool-call part has providerOptions mapped from providerMetadata
      const toolCallPart = (assistantMessage?.content as any[])?.find(
        part => part.type === 'tool-call',
      );
      expect(toolCallPart).toBeDefined();
      expect(toolCallPart.providerOptions).toEqual({
        google: {
          thoughtSignature: 'sig_abc123_test_signature',
        },
      });
    });

    it('should not add providerOptions when providerMetadata is undefined', async () => {
      const mockWritable = createMockWritable();
      const mockModel = vi.fn();

      let capturedPrompt: LanguageModelV4Prompt | undefined;

      const toolCallWithoutMetadata: LanguageModelV4ToolCall = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'testTool',
        input: '{"query":"test"}',
        // No providerMetadata
      };

      vi.mocked(doStreamStep)
        .mockResolvedValueOnce(
          createMockDoStreamStepResult({
            toolCalls: [toolCallWithoutMetadata],
            finishReason: 'tool-calls',
            finishRaw: 'tool_calls',
          }),
        )
        .mockImplementationOnce(
          async (prompt, _modelInit, _writable, _tools, _options) => {
            capturedPrompt = prompt;
            return createMockDoStreamStepResult();
          },
        );

      const iterator = streamTextIterator({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
        tools: {
          testTool: {
            description: 'A test tool',
            execute: async () => ({ result: 'success' }),
          },
        } as unknown as ToolSet,
        writable: mockWritable,
        model: mockModel as any,
      });

      const firstResult = await iterator.next();
      expect(firstResult.done).toBe(false);

      const toolResults: LanguageModelV4ToolResultPart[] = [
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'testTool',
          output: { type: 'text', value: '{"result":"success"}' },
        },
      ];

      await iterator.next(toolResults);

      const assistantMessage = capturedPrompt?.find(
        msg => msg.role === 'assistant',
      );
      const toolCallPart = (assistantMessage?.content as any[])?.find(
        part => part.type === 'tool-call',
      );

      expect(toolCallPart).toBeDefined();
      expect(toolCallPart.providerOptions).toBeUndefined();
    });

    it('should preserve providerMetadata for multiple parallel tool calls', async () => {
      const mockWritable = createMockWritable();
      const mockModel = vi.fn();

      let capturedPrompt: LanguageModelV4Prompt | undefined;

      const toolCalls: LanguageModelV4ToolCall[] = [
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'weatherTool',
          input: '{"city":"NYC"}',
          providerMetadata: {
            google: { thoughtSignature: 'sig_weather_123' },
          },
        },
        {
          type: 'tool-call',
          toolCallId: 'call-2',
          toolName: 'newsTool',
          input: '{"topic":"tech"}',
          providerMetadata: {
            google: { thoughtSignature: 'sig_news_456' },
          },
        },
      ];

      vi.mocked(doStreamStep)
        .mockResolvedValueOnce(
          createMockDoStreamStepResult({
            toolCalls,
            finishReason: 'tool-calls',
            finishRaw: 'tool_calls',
          }),
        )
        .mockImplementationOnce(
          async (prompt, _modelInit, _writable, _tools, _options) => {
            capturedPrompt = prompt;
            return createMockDoStreamStepResult();
          },
        );

      const iterator = streamTextIterator({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
        tools: {
          weatherTool: {
            description: 'Weather tool',
            execute: async () => ({ temp: 72 }),
          },
          newsTool: {
            description: 'News tool',
            execute: async () => ({ headlines: [] }),
          },
        } as unknown as ToolSet,
        writable: mockWritable,
        model: mockModel as any,
      });

      const firstResult = await iterator.next();
      expect(firstResult.done).toBe(false);
      const firstValue = firstResult.value as StreamTextIteratorYieldValue;
      expect(firstValue.toolCalls).toHaveLength(2);

      const toolResults: LanguageModelV4ToolResultPart[] = [
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'weatherTool',
          output: { type: 'text', value: '{"temp":72}' },
        },
        {
          type: 'tool-result',
          toolCallId: 'call-2',
          toolName: 'newsTool',
          output: { type: 'text', value: '{"headlines":[]}' },
        },
      ];

      await iterator.next(toolResults);

      const assistantMessage = capturedPrompt?.find(
        msg => msg.role === 'assistant',
      );
      const toolCallParts = (assistantMessage?.content as any[])?.filter(
        part => part.type === 'tool-call',
      );

      expect(toolCallParts).toHaveLength(2);

      // Verify each tool call has its own providerOptions
      const weatherToolCall = toolCallParts?.find(
        part => part.toolName === 'weatherTool',
      );
      expect(weatherToolCall?.providerOptions).toEqual({
        google: { thoughtSignature: 'sig_weather_123' },
      });

      const newsToolCall = toolCallParts?.find(
        part => part.toolName === 'newsTool',
      );
      expect(newsToolCall?.providerOptions).toEqual({
        google: { thoughtSignature: 'sig_news_456' },
      });
    });

    it('should handle mixed tool calls with and without providerMetadata', async () => {
      const mockWritable = createMockWritable();
      const mockModel = vi.fn();

      let capturedPrompt: LanguageModelV4Prompt | undefined;

      const toolCalls: LanguageModelV4ToolCall[] = [
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'toolWithMeta',
          input: '{}',
          providerMetadata: {
            vertex: { thoughtSignature: 'sig_vertex_789' },
          },
        },
        {
          type: 'tool-call',
          toolCallId: 'call-2',
          toolName: 'toolWithoutMeta',
          input: '{}',
          // No providerMetadata
        },
      ];

      vi.mocked(doStreamStep)
        .mockResolvedValueOnce(
          createMockDoStreamStepResult({
            toolCalls,
            finishReason: 'tool-calls',
            finishRaw: 'tool_calls',
          }),
        )
        .mockImplementationOnce(
          async (prompt, _modelInit, _writable, _tools, _options) => {
            capturedPrompt = prompt;
            return createMockDoStreamStepResult();
          },
        );

      const iterator = streamTextIterator({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
        tools: {
          toolWithMeta: {
            description: 'Tool with metadata',
            execute: async () => ({ ok: true }),
          },
          toolWithoutMeta: {
            description: 'Tool without metadata',
            execute: async () => ({ ok: true }),
          },
        } as unknown as ToolSet,
        writable: mockWritable,
        model: mockModel as any,
      });

      await iterator.next();

      const toolResults: LanguageModelV4ToolResultPart[] = [
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'toolWithMeta',
          output: { type: 'text', value: '{"ok":true}' },
        },
        {
          type: 'tool-result',
          toolCallId: 'call-2',
          toolName: 'toolWithoutMeta',
          output: { type: 'text', value: '{"ok":true}' },
        },
      ];

      await iterator.next(toolResults);

      const assistantMessage = capturedPrompt?.find(
        msg => msg.role === 'assistant',
      );
      const toolCallParts = (assistantMessage?.content as any[])?.filter(
        part => part.type === 'tool-call',
      );

      const toolWithMeta = toolCallParts?.find(
        part => part.toolName === 'toolWithMeta',
      );
      expect(toolWithMeta?.providerOptions).toEqual({
        vertex: { thoughtSignature: 'sig_vertex_789' },
      });

      const toolWithoutMeta = toolCallParts?.find(
        part => part.toolName === 'toolWithoutMeta',
      );
      expect(toolWithoutMeta?.providerOptions).toBeUndefined();
    });

    it('should strip OpenAI itemId from providerMetadata to avoid reasoning item errors', async () => {
      const mockWritable = createMockWritable();
      const mockModel = vi.fn();

      let capturedPrompt: LanguageModelV4Prompt | undefined;

      // OpenAI Responses API returns itemId which requires reasoning items we don't preserve
      const toolCallWithOpenAIMetadata: LanguageModelV4ToolCall = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'testTool',
        input: '{"query":"test"}',
        providerMetadata: {
          openai: {
            itemId: 'fc_0402bf2d292dd7ed00697a35fb10e0819ab0098545c4d0d7f5',
          },
        },
      };

      vi.mocked(doStreamStep)
        .mockResolvedValueOnce(
          createMockDoStreamStepResult({
            toolCalls: [toolCallWithOpenAIMetadata],
            finishReason: 'tool-calls',
            finishRaw: 'tool_calls',
          }),
        )
        .mockImplementationOnce(
          async (prompt, _modelInit, _writable, _tools, _options) => {
            capturedPrompt = prompt;
            return createMockDoStreamStepResult();
          },
        );

      const iterator = streamTextIterator({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
        tools: {
          testTool: {
            description: 'A test tool',
            execute: async () => ({ result: 'success' }),
          },
        } as unknown as ToolSet,
        writable: mockWritable,
        model: mockModel as any,
      });

      await iterator.next();

      const toolResults: LanguageModelV4ToolResultPart[] = [
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'testTool',
          output: { type: 'text', value: '{"result":"success"}' },
        },
      ];

      await iterator.next(toolResults);

      const assistantMessage = capturedPrompt?.find(
        msg => msg.role === 'assistant',
      );
      const toolCallPart = (assistantMessage?.content as any[])?.find(
        part => part.type === 'tool-call',
      );

      // itemId should be stripped, leaving no providerOptions
      expect(toolCallPart).toBeDefined();
      expect(toolCallPart.providerOptions).toBeUndefined();
    });

    it('should preserve other OpenAI metadata while stripping itemId', async () => {
      const mockWritable = createMockWritable();
      const mockModel = vi.fn();

      let capturedPrompt: LanguageModelV4Prompt | undefined;

      // OpenAI metadata with both itemId (should be stripped) and other fields (should be preserved)
      const toolCallWithMixedOpenAIMetadata: LanguageModelV4ToolCall = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'testTool',
        input: '{"query":"test"}',
        providerMetadata: {
          openai: {
            itemId: 'fc_0402bf2d292dd7ed00697a35fb10e0819ab0098545c4d0d7f5',
            someOtherField: 'should-be-preserved',
          },
        },
      };

      vi.mocked(doStreamStep)
        .mockResolvedValueOnce(
          createMockDoStreamStepResult({
            toolCalls: [toolCallWithMixedOpenAIMetadata],
            finishReason: 'tool-calls',
            finishRaw: 'tool_calls',
          }),
        )
        .mockImplementationOnce(
          async (prompt, _modelInit, _writable, _tools, _options) => {
            capturedPrompt = prompt;
            return createMockDoStreamStepResult();
          },
        );

      const iterator = streamTextIterator({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
        tools: {
          testTool: {
            description: 'A test tool',
            execute: async () => ({ result: 'success' }),
          },
        } as unknown as ToolSet,
        writable: mockWritable,
        model: mockModel as any,
      });

      await iterator.next();

      const toolResults: LanguageModelV4ToolResultPart[] = [
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'testTool',
          output: { type: 'text', value: '{"result":"success"}' },
        },
      ];

      await iterator.next(toolResults);

      const assistantMessage = capturedPrompt?.find(
        msg => msg.role === 'assistant',
      );
      const toolCallPart = (assistantMessage?.content as any[])?.find(
        part => part.type === 'tool-call',
      );

      // itemId should be stripped, but other fields preserved
      expect(toolCallPart).toBeDefined();
      expect(toolCallPart.providerOptions).toEqual({
        openai: {
          someOtherField: 'should-be-preserved',
        },
      });
    });

    it('should preserve Gemini metadata while stripping OpenAI itemId in mixed provider metadata', async () => {
      const mockWritable = createMockWritable();
      const mockModel = vi.fn();

      let capturedPrompt: LanguageModelV4Prompt | undefined;

      // Mixed provider metadata - Gemini should be fully preserved, OpenAI itemId stripped
      const toolCallWithMixedProviders: LanguageModelV4ToolCall = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'testTool',
        input: '{"query":"test"}',
        providerMetadata: {
          google: {
            thoughtSignature: 'sig_gemini_preserved',
          },
          openai: {
            itemId: 'fc_should_be_stripped',
          },
        },
      };

      vi.mocked(doStreamStep)
        .mockResolvedValueOnce(
          createMockDoStreamStepResult({
            toolCalls: [toolCallWithMixedProviders],
            finishReason: 'tool-calls',
            finishRaw: 'tool_calls',
          }),
        )
        .mockImplementationOnce(
          async (prompt, _modelInit, _writable, _tools, _options) => {
            capturedPrompt = prompt;
            return createMockDoStreamStepResult();
          },
        );

      const iterator = streamTextIterator({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
        tools: {
          testTool: {
            description: 'A test tool',
            execute: async () => ({ result: 'success' }),
          },
        } as unknown as ToolSet,
        writable: mockWritable,
        model: mockModel as any,
      });

      await iterator.next();

      const toolResults: LanguageModelV4ToolResultPart[] = [
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'testTool',
          output: { type: 'text', value: '{"result":"success"}' },
        },
      ];

      await iterator.next(toolResults);

      const assistantMessage = capturedPrompt?.find(
        msg => msg.role === 'assistant',
      );
      const toolCallPart = (assistantMessage?.content as any[])?.find(
        part => part.type === 'tool-call',
      );

      // Gemini metadata should be preserved, OpenAI itemId stripped
      expect(toolCallPart).toBeDefined();
      expect(toolCallPart.providerOptions).toEqual({
        google: {
          thoughtSignature: 'sig_gemini_preserved',
        },
      });
    });
  });

  describe('runtimeContext and toolsContext', () => {
    it('should pass current contexts to doStreamStep and yielded steps', async () => {
      const runtimeContext = { tenantId: 'tenant_123' };
      const toolsContext = { weather: { unit: 'celsius' } };
      const step = createMockStepResult();

      vi.mocked(doStreamStep).mockResolvedValueOnce({
        toolCalls: [],
        finish: createMockFinish('stop'),
        step,
        providerExecutedToolResults: new Map(),
      });

      const iterator = streamTextIterator({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
        tools: {} as ToolSet,
        writable: createMockWritable(),
        model: vi.fn() as any,
        runtimeContext,
        toolsContext,
      });

      const result = await iterator.next();

      expect(doStreamStep).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Function),
        expect.any(WritableStream),
        expect.any(Object),
        expect.objectContaining({
          runtimeContext,
          toolsContext,
          stepNumber: 0,
        }),
      );
      expect(result.value).toMatchObject({
        step,
        runtimeContext,
        toolsContext,
      });
    });
  });
});
