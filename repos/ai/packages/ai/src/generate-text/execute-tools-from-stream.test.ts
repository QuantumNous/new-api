import {
  delay,
  tool,
  type Experimental_SandboxSession as SandboxSession,
} from '@ai-sdk/provider-utils';
import {
  convertArrayToReadableStream,
  convertReadableStreamToArray,
  mockId,
} from '@ai-sdk/provider-utils/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockSandboxSessionFileStubs } from '../test/mock-sandbox';
import { z } from 'zod/v4';
import { TypeValidationError } from '../error';
import { asLanguageModelUsage } from '../types/usage';
import { now } from '../util/now';
import { executeToolsFromStream } from './execute-tools-from-stream';
import type { LanguageModelStreamPart } from './stream-language-model-call';
import type {
  ToolExecutionEndEvent,
  ToolExecutionStartEvent,
} from './tool-execution-events';

// mock now function
vi.mock('../util/now', () => ({
  now: vi.fn(),
}));

const mockNow = vi.mocked(now);

const finishChunk = {
  type: 'model-call-end' as const,
  finishReason: 'stop' as const,
  rawFinishReason: 'stop' as const,
  usage: asLanguageModelUsage({
    inputTokens: {
      total: 3,
      noCache: 3,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: 10,
      text: 10,
      reasoning: undefined,
    },
  }),
  performance: {
    responseTimeMs: 0,
    effectiveOutputTokensPerSecond: 0,
    outputTokensPerSecond: undefined,
    inputTokensPerSecond: undefined,
    effectiveTotalTokensPerSecond: 0,
    timeToFirstOutputMs: undefined,
  },
};

describe('executeToolsFromStream', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockNow.mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle async tool execution', async () => {
    const tools = {
      syncTool: tool({
        inputSchema: z.object({ value: z.string() }),
        execute: async ({ value }) => `${value}-sync-result`,
      }),
    };

    const inputStream: ReadableStream<LanguageModelStreamPart<typeof tools>> =
      convertArrayToReadableStream([
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'syncTool',
          input: { value: 'test' },
        },
        finishChunk,
      ]);

    const transformedStream = executeToolsFromStream({
      stream: inputStream,
      generateId: mockId({ prefix: 'id' }),
      tools,
      callId: 'test-telemetry-call-id',
      messages: [],
      timeout: undefined,
      abortSignal: undefined,
      toolsContext: {},
      runtimeContext: {},
    });

    expect(await convertReadableStreamToArray(transformedStream))
      .toMatchInlineSnapshot(`
        [
          {
            "input": {
              "value": "test",
            },
            "toolCallId": "call-1",
            "toolName": "syncTool",
            "type": "tool-call",
          },
          {
            "finishReason": "stop",
            "performance": {
              "effectiveOutputTokensPerSecond": 0,
              "effectiveTotalTokensPerSecond": 0,
              "inputTokensPerSecond": undefined,
              "outputTokensPerSecond": undefined,
              "responseTimeMs": 0,
              "timeToFirstOutputMs": undefined,
            },
            "rawFinishReason": "stop",
            "type": "model-call-end",
            "usage": {
              "inputTokenDetails": {
                "cacheReadTokens": undefined,
                "cacheWriteTokens": undefined,
                "noCacheTokens": 3,
              },
              "inputTokens": 3,
              "outputTokenDetails": {
                "reasoningTokens": undefined,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "raw": undefined,
              "totalTokens": 13,
            },
          },
          {
            "toolCallId": "call-1",
            "toolExecutionMs": 0,
            "type": "tool-execution-end",
          },
          {
            "dynamic": false,
            "input": {
              "value": "test",
            },
            "output": "test-sync-result",
            "toolCallId": "call-1",
            "toolName": "syncTool",
            "type": "tool-result",
          },
        ]
      `);
  });

  it('should handle sync tool execution', async () => {
    const tools = {
      syncTool: tool({
        inputSchema: z.object({ value: z.string() }),
        execute: async ({ value }) => `${value}-sync-result`,
      }),
    };

    const inputStream: ReadableStream<LanguageModelStreamPart<typeof tools>> =
      convertArrayToReadableStream([
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'syncTool',
          input: { value: 'test' },
        },
        finishChunk,
      ]);

    const transformedStream = executeToolsFromStream({
      stream: inputStream,
      generateId: mockId({ prefix: 'id' }),
      tools,
      callId: 'test-telemetry-call-id',
      messages: [],
      abortSignal: undefined,
      timeout: undefined,
      toolsContext: {},
      runtimeContext: {},
    });

    expect(await convertReadableStreamToArray(transformedStream))
      .toMatchInlineSnapshot(`
        [
          {
            "input": {
              "value": "test",
            },
            "toolCallId": "call-1",
            "toolName": "syncTool",
            "type": "tool-call",
          },
          {
            "finishReason": "stop",
            "performance": {
              "effectiveOutputTokensPerSecond": 0,
              "effectiveTotalTokensPerSecond": 0,
              "inputTokensPerSecond": undefined,
              "outputTokensPerSecond": undefined,
              "responseTimeMs": 0,
              "timeToFirstOutputMs": undefined,
            },
            "rawFinishReason": "stop",
            "type": "model-call-end",
            "usage": {
              "inputTokenDetails": {
                "cacheReadTokens": undefined,
                "cacheWriteTokens": undefined,
                "noCacheTokens": 3,
              },
              "inputTokens": 3,
              "outputTokenDetails": {
                "reasoningTokens": undefined,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "raw": undefined,
              "totalTokens": 13,
            },
          },
          {
            "toolCallId": "call-1",
            "toolExecutionMs": 0,
            "type": "tool-execution-end",
          },
          {
            "dynamic": false,
            "input": {
              "value": "test",
            },
            "output": "test-sync-result",
            "toolCallId": "call-1",
            "toolName": "syncTool",
            "type": "tool-result",
          },
        ]
      `);
  });

  it('should pass sandbox to tool execution', async () => {
    const sandbox = {
      description: 'test sandbox',
      run: vi.fn(async () => ({
        exitCode: 0,
        stdout: 'ok',
        stderr: '',
      })),
      ...mockSandboxSessionFileStubs,
    } satisfies SandboxSession;
    let receivedSandbox: SandboxSession | undefined;

    const tools = {
      sandboxTool: tool({
        inputSchema: z.object({ value: z.string() }),
        execute: async ({ value }, { experimental_sandbox: sandbox }) => {
          receivedSandbox = sandbox;
          return `${value}-sandbox-result`;
        },
      }),
    };

    const inputStream: ReadableStream<LanguageModelStreamPart<typeof tools>> =
      convertArrayToReadableStream([
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'sandboxTool',
          input: { value: 'test' },
        },
        finishChunk,
      ]);

    await convertReadableStreamToArray(
      executeToolsFromStream({
        stream: inputStream,
        generateId: mockId({ prefix: 'id' }),
        tools,
        callId: 'test-telemetry-call-id',
        messages: [],
        abortSignal: undefined,
        timeout: undefined,
        experimental_sandbox: sandbox,
        toolsContext: {},
        runtimeContext: {},
      }),
    );

    expect(receivedSandbox).toBe(sandbox);
  });

  it('should not call execute for provider-executed tool calls', async () => {
    const tools = {
      providerTool: tool({
        inputSchema: z.object({ value: z.string() }),
        execute: async ({ value }) => {
          toolExecuted = true;
          return `${value}-should-not-execute`;
        },
      }),
    };

    let toolExecuted = false;

    const inputStream: ReadableStream<LanguageModelStreamPart<typeof tools>> =
      convertArrayToReadableStream([
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'providerTool',
          input: { value: 'test' },
          providerExecuted: true,
        },
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'providerTool',
          providerExecuted: true,
          input: { value: 'test' },
          output: 'example-result',
        },
        finishChunk,
      ]);

    const transformedStream = executeToolsFromStream({
      stream: inputStream,
      generateId: mockId({ prefix: 'id' }),
      tools,
      callId: 'test-telemetry-call-id',
      messages: [],
      abortSignal: undefined,
      timeout: undefined,
      toolsContext: {},
      runtimeContext: {},
    });

    await convertReadableStreamToArray(transformedStream);

    expect(toolExecuted).toBe(false);
  });

  it('should emit approval request and approved response before executing auto-approved tools', async () => {
    const execute = vi.fn(async ({ value }: { value: string }) => {
      return `${value}-approved-result`;
    });

    const tools = {
      approvedTool: tool({
        inputSchema: z.object({ value: z.string() }),
        execute,
      }),
    };

    const inputStream: ReadableStream<LanguageModelStreamPart<typeof tools>> =
      convertArrayToReadableStream([
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'approvedTool',
          input: { value: 'test' },
        },
        finishChunk,
      ]);

    const transformedStream = executeToolsFromStream({
      stream: inputStream,
      generateId: mockId({ prefix: 'id' }),
      tools,
      callId: 'test-telemetry-call-id',
      messages: [],
      abortSignal: undefined,
      timeout: undefined,
      toolsContext: {},
      runtimeContext: {},
      toolApproval: {
        approvedTool: {
          type: 'approved',
          reason: 'trusted internal tool',
        },
      },
    });

    expect(await convertReadableStreamToArray(transformedStream))
      .toMatchInlineSnapshot(`
        [
          {
            "input": {
              "value": "test",
            },
            "toolCallId": "call-1",
            "toolName": "approvedTool",
            "type": "tool-call",
          },
          {
            "approvalId": "id-0",
            "isAutomatic": true,
            "toolCall": {
              "input": {
                "value": "test",
              },
              "toolCallId": "call-1",
              "toolName": "approvedTool",
              "type": "tool-call",
            },
            "type": "tool-approval-request",
          },
          {
            "approvalId": "id-0",
            "approved": true,
            "providerExecuted": undefined,
            "reason": "trusted internal tool",
            "toolCall": {
              "input": {
                "value": "test",
              },
              "toolCallId": "call-1",
              "toolName": "approvedTool",
              "type": "tool-call",
            },
            "type": "tool-approval-response",
          },
          {
            "finishReason": "stop",
            "performance": {
              "effectiveOutputTokensPerSecond": 0,
              "effectiveTotalTokensPerSecond": 0,
              "inputTokensPerSecond": undefined,
              "outputTokensPerSecond": undefined,
              "responseTimeMs": 0,
              "timeToFirstOutputMs": undefined,
            },
            "rawFinishReason": "stop",
            "type": "model-call-end",
            "usage": {
              "inputTokenDetails": {
                "cacheReadTokens": undefined,
                "cacheWriteTokens": undefined,
                "noCacheTokens": 3,
              },
              "inputTokens": 3,
              "outputTokenDetails": {
                "reasoningTokens": undefined,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "raw": undefined,
              "totalTokens": 13,
            },
          },
          {
            "toolCallId": "call-1",
            "toolExecutionMs": 0,
            "type": "tool-execution-end",
          },
          {
            "dynamic": false,
            "input": {
              "value": "test",
            },
            "output": "test-approved-result",
            "toolCallId": "call-1",
            "toolName": "approvedTool",
            "type": "tool-result",
          },
        ]
      `);

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('should emit approval request and denied response without executing auto-denied tools', async () => {
    let toolExecuted = false;

    const tools = {
      deniedTool: tool({
        inputSchema: z.object({ value: z.string() }),
        execute: async ({ value }) => {
          toolExecuted = true;
          return `${value}-denied-result`;
        },
      }),
    };

    const inputStream: ReadableStream<LanguageModelStreamPart<typeof tools>> =
      convertArrayToReadableStream([
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'deniedTool',
          input: { value: 'test' },
        },
        finishChunk,
      ]);

    const transformedStream = executeToolsFromStream({
      stream: inputStream,
      generateId: mockId({ prefix: 'id' }),
      tools,
      callId: 'test-telemetry-call-id',
      messages: [],
      abortSignal: undefined,
      timeout: undefined,
      toolsContext: {},
      runtimeContext: {},
      toolApproval: {
        deniedTool: {
          type: 'denied',
          reason: 'blocked by policy',
        },
      },
    });

    expect(await convertReadableStreamToArray(transformedStream))
      .toMatchInlineSnapshot(`
        [
          {
            "input": {
              "value": "test",
            },
            "toolCallId": "call-1",
            "toolName": "deniedTool",
            "type": "tool-call",
          },
          {
            "approvalId": "id-0",
            "isAutomatic": true,
            "toolCall": {
              "input": {
                "value": "test",
              },
              "toolCallId": "call-1",
              "toolName": "deniedTool",
              "type": "tool-call",
            },
            "type": "tool-approval-request",
          },
          {
            "approvalId": "id-0",
            "approved": false,
            "providerExecuted": undefined,
            "reason": "blocked by policy",
            "toolCall": {
              "input": {
                "value": "test",
              },
              "toolCallId": "call-1",
              "toolName": "deniedTool",
              "type": "tool-call",
            },
            "type": "tool-approval-response",
          },
          {
            "finishReason": "stop",
            "performance": {
              "effectiveOutputTokensPerSecond": 0,
              "effectiveTotalTokensPerSecond": 0,
              "inputTokensPerSecond": undefined,
              "outputTokensPerSecond": undefined,
              "responseTimeMs": 0,
              "timeToFirstOutputMs": undefined,
            },
            "rawFinishReason": "stop",
            "type": "model-call-end",
            "usage": {
              "inputTokenDetails": {
                "cacheReadTokens": undefined,
                "cacheWriteTokens": undefined,
                "noCacheTokens": 3,
              },
              "inputTokens": 3,
              "outputTokenDetails": {
                "reasoningTokens": undefined,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "raw": undefined,
              "totalTokens": 13,
            },
          },
        ]
      `);

    expect(toolExecuted).toBe(false);
  });

  describe('onToolExecutionStart and onToolExecutionEnd callbacks', () => {
    it('should call onToolExecutionStart before tool execution and onToolExecutionEnd after', async () => {
      const tools = {
        testTool: tool({
          inputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => {
            callOrder.push('execute');
            return `${value}-result`;
          },
        }),
      };

      const callOrder: string[] = [];

      const inputStream: ReadableStream<LanguageModelStreamPart<typeof tools>> =
        convertArrayToReadableStream([
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'testTool',
            input: { value: 'hello' },
          },
          finishChunk,
        ]);

      const transformedStream = executeToolsFromStream({
        stream: inputStream,
        generateId: mockId({ prefix: 'id' }),
        tools,
        callId: 'test-telemetry-call-id',
        messages: [],
        timeout: undefined,
        abortSignal: undefined,
        toolsContext: {},
        runtimeContext: {},
        onToolExecutionStart: async () => {
          callOrder.push('onToolExecutionStart');
        },
        onToolExecutionEnd: async () => {
          callOrder.push('onToolExecutionEnd');
        },
      });

      await convertReadableStreamToArray(transformedStream);

      expect(callOrder).toEqual([
        'onToolExecutionStart',
        'execute',
        'onToolExecutionEnd',
      ]);
    });

    it('should pass stepNumber and model to callbacks', async () => {
      const tools = {
        testTool: tool({
          inputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => `${value}-result`,
        }),
      };

      const startEvents: ToolExecutionStartEvent<typeof tools>[] = [];
      const finishEvents: ToolExecutionEndEvent<typeof tools>[] = [];

      const inputStream: ReadableStream<LanguageModelStreamPart<typeof tools>> =
        convertArrayToReadableStream([
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'testTool',
            input: { value: 'test' },
          },
          finishChunk,
        ]);

      const transformedStream = executeToolsFromStream({
        stream: inputStream,
        generateId: mockId({ prefix: 'id' }),
        tools,
        callId: 'test-telemetry-call-id',
        messages: [],
        timeout: undefined,
        abortSignal: undefined,
        toolsContext: { testTool: { value: 'test' } },
        runtimeContext: {},
        onToolExecutionStart: async event => {
          startEvents.push(event);
        },
        onToolExecutionEnd: async event => {
          finishEvents.push(event);
        },
      });

      await convertReadableStreamToArray(transformedStream);

      expect(startEvents).toMatchInlineSnapshot(`
        [
          {
            "callId": "test-telemetry-call-id",
            "messages": [],
            "toolCall": {
              "input": {
                "value": "test",
              },
              "toolCallId": "call-1",
              "toolName": "testTool",
              "type": "tool-call",
            },
            "toolContext": {
              "value": "test",
            },
          },
        ]
      `);
      expect(finishEvents).toMatchInlineSnapshot(`
        [
          {
            "callId": "test-telemetry-call-id",
            "messages": [],
            "toolCall": {
              "input": {
                "value": "test",
              },
              "toolCallId": "call-1",
              "toolName": "testTool",
              "type": "tool-call",
            },
            "toolContext": {
              "value": "test",
            },
            "toolExecutionMs": 0,
            "toolOutput": {
              "dynamic": false,
              "input": {
                "value": "test",
              },
              "output": "test-result",
              "toolCallId": "call-1",
              "toolName": "testTool",
              "type": "tool-result",
            },
          },
        ]
      `);
    });

    it('should call onToolExecutionEnd with success data', async () => {
      const tools = {
        testTool: tool({
          inputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => `${value}-result`,
        }),
      };

      const toolExecutionEndEvents: ToolExecutionEndEvent<typeof tools>[] = [];

      const inputStream: ReadableStream<LanguageModelStreamPart<typeof tools>> =
        convertArrayToReadableStream([
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'testTool',
            input: { value: 'abc' },
          },
          finishChunk,
        ]);

      const transformedStream = executeToolsFromStream({
        stream: inputStream,
        generateId: mockId({ prefix: 'id' }),
        tools,
        callId: 'test-telemetry-call-id',
        messages: [],
        timeout: undefined,
        abortSignal: undefined,
        toolsContext: {},
        runtimeContext: {},
        onToolExecutionEnd: async event => {
          toolExecutionEndEvents.push(event);
        },
      });

      await convertReadableStreamToArray(transformedStream);

      expect(toolExecutionEndEvents).toMatchInlineSnapshot(`
        [
          {
            "callId": "test-telemetry-call-id",
            "messages": [],
            "toolCall": {
              "input": {
                "value": "abc",
              },
              "toolCallId": "call-1",
              "toolName": "testTool",
              "type": "tool-call",
            },
            "toolContext": undefined,
            "toolExecutionMs": 0,
            "toolOutput": {
              "dynamic": false,
              "input": {
                "value": "abc",
              },
              "output": "abc-result",
              "toolCallId": "call-1",
              "toolName": "testTool",
              "type": "tool-result",
            },
          },
        ]
      `);
    });

    it('should call onToolExecutionEnd with error data when tool fails', async () => {
      const tools = {
        failingTool: tool({
          inputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => {
            if (value === 'test') {
              throw new Error('tool failed');
            }
            return 'test-result';
          },
        }),
      };

      const toolExecutionEndEvents: ToolExecutionEndEvent<typeof tools>[] = [];

      const inputStream: ReadableStream<LanguageModelStreamPart<typeof tools>> =
        convertArrayToReadableStream([
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'failingTool',
            input: { value: 'test' },
          },
          finishChunk,
        ]);

      const transformedStream = executeToolsFromStream({
        stream: inputStream,
        generateId: mockId({ prefix: 'id' }),
        tools,
        callId: 'test-telemetry-call-id',
        messages: [],
        timeout: undefined,
        abortSignal: undefined,
        toolsContext: {},
        runtimeContext: {},
        onToolExecutionEnd: async event => {
          toolExecutionEndEvents.push(event);
        },
      });

      await convertReadableStreamToArray(transformedStream);

      expect(toolExecutionEndEvents).toMatchInlineSnapshot(`
        [
          {
            "callId": "test-telemetry-call-id",
            "messages": [],
            "toolCall": {
              "input": {
                "value": "test",
              },
              "toolCallId": "call-1",
              "toolName": "failingTool",
              "type": "tool-call",
            },
            "toolContext": undefined,
            "toolExecutionMs": 0,
            "toolOutput": {
              "dynamic": false,
              "error": [Error: tool failed],
              "input": {
                "value": "test",
              },
              "toolCallId": "call-1",
              "toolName": "failingTool",
              "type": "tool-error",
            },
          },
        ]
      `);
    });

    it('should not call callbacks for tools without execute', async () => {
      const tools = {
        noExecuteTool: tool({
          inputSchema: z.object({ value: z.string() }),
        }),
      };

      const toolExecutionStartEvents: ToolExecutionStartEvent<typeof tools>[] =
        [];
      const toolExecutionEndEvents: ToolExecutionEndEvent<typeof tools>[] = [];

      const inputStream: ReadableStream<LanguageModelStreamPart<typeof tools>> =
        convertArrayToReadableStream([
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'noExecuteTool',
            input: { value: 'test' },
          },
          finishChunk,
        ]);

      const transformedStream = executeToolsFromStream({
        stream: inputStream,
        generateId: mockId({ prefix: 'id' }),
        tools,
        callId: 'test-telemetry-call-id',
        messages: [],
        timeout: undefined,
        abortSignal: undefined,
        toolsContext: {},
        runtimeContext: {},
        onToolExecutionStart: async event => {
          toolExecutionStartEvents.push(event);
        },
        onToolExecutionEnd: async event => {
          toolExecutionEndEvents.push(event);
        },
      });

      await convertReadableStreamToArray(transformedStream);

      expect(toolExecutionStartEvents).toMatchInlineSnapshot(`[]`);
      expect(toolExecutionEndEvents).toMatchInlineSnapshot(`[]`);
    });

    it('should call callbacks for each tool in a multi-tool stream', async () => {
      const tools = {
        testTool: tool({
          inputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => `${value}-result`,
        }),
      };

      const toolExecutionStartEvents: ToolExecutionStartEvent<typeof tools>[] =
        [];
      const toolExecutionEndEvents: ToolExecutionEndEvent<typeof tools>[] = [];

      const inputStream: ReadableStream<LanguageModelStreamPart<typeof tools>> =
        convertArrayToReadableStream([
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'testTool',
            input: { value: 'a' },
          },
          {
            type: 'tool-call',
            toolCallId: 'call-2',
            toolName: 'testTool',
            input: { value: 'b' },
          },
          finishChunk,
        ]);

      const transformedStream = executeToolsFromStream({
        stream: inputStream,
        generateId: mockId({ prefix: 'id' }),
        tools,
        callId: 'test-telemetry-call-id',
        messages: [],
        timeout: undefined,
        abortSignal: undefined,
        toolsContext: {},
        runtimeContext: {},
        onToolExecutionStart: async event => {
          toolExecutionStartEvents.push(event);
        },
        onToolExecutionEnd: async event => {
          toolExecutionEndEvents.push(event);
        },
      });

      await convertReadableStreamToArray(transformedStream);

      expect(toolExecutionStartEvents).toMatchInlineSnapshot(`
        [
          {
            "callId": "test-telemetry-call-id",
            "messages": [],
            "toolCall": {
              "input": {
                "value": "a",
              },
              "toolCallId": "call-1",
              "toolName": "testTool",
              "type": "tool-call",
            },
            "toolContext": undefined,
          },
          {
            "callId": "test-telemetry-call-id",
            "messages": [],
            "toolCall": {
              "input": {
                "value": "b",
              },
              "toolCallId": "call-2",
              "toolName": "testTool",
              "type": "tool-call",
            },
            "toolContext": undefined,
          },
        ]
      `);
      expect(toolExecutionEndEvents).toMatchInlineSnapshot(`
        [
          {
            "callId": "test-telemetry-call-id",
            "messages": [],
            "toolCall": {
              "input": {
                "value": "a",
              },
              "toolCallId": "call-1",
              "toolName": "testTool",
              "type": "tool-call",
            },
            "toolContext": undefined,
            "toolExecutionMs": 0,
            "toolOutput": {
              "dynamic": false,
              "input": {
                "value": "a",
              },
              "output": "a-result",
              "toolCallId": "call-1",
              "toolName": "testTool",
              "type": "tool-result",
            },
          },
          {
            "callId": "test-telemetry-call-id",
            "messages": [],
            "toolCall": {
              "input": {
                "value": "b",
              },
              "toolCallId": "call-2",
              "toolName": "testTool",
              "type": "tool-call",
            },
            "toolContext": undefined,
            "toolExecutionMs": 0,
            "toolOutput": {
              "dynamic": false,
              "input": {
                "value": "b",
              },
              "output": "b-result",
              "toolCallId": "call-2",
              "toolName": "testTool",
              "type": "tool-result",
            },
          },
        ]
      `);
    });

    it('should not call callbacks for provider-executed tools', async () => {
      const tools = {
        providerTool: tool({
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        }),
      };

      const toolExecutionStartEvents: ToolExecutionStartEvent<typeof tools>[] =
        [];
      const toolExecutionEndEvents: ToolExecutionEndEvent<typeof tools>[] = [];

      const inputStream: ReadableStream<LanguageModelStreamPart<typeof tools>> =
        convertArrayToReadableStream([
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'providerTool',
            input: { value: 'test' },
            providerExecuted: true,
          },
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'providerTool',
            providerExecuted: true,
            input: { value: 'test' },
            output: { result: 'example' },
          },
          finishChunk,
        ]);

      const transformedStream = executeToolsFromStream({
        stream: inputStream,
        generateId: mockId({ prefix: 'id' }),
        tools,
        callId: 'test-telemetry-call-id',
        messages: [],
        timeout: undefined,
        abortSignal: undefined,
        toolsContext: {},
        runtimeContext: {},
        onToolExecutionStart: async event => {
          toolExecutionStartEvents.push(event);
        },
        onToolExecutionEnd: async event => {
          toolExecutionEndEvents.push(event);
        },
      });

      await convertReadableStreamToArray(transformedStream);

      expect(toolExecutionStartEvents).toMatchInlineSnapshot(`[]`);
      expect(toolExecutionEndEvents).toMatchInlineSnapshot(`[]`);
    });
  });

  describe('tool execution error handling', () => {
    it('should throw TypeValidationError before approval callbacks run', async () => {
      const needsApproval = vi.fn(() => true);

      const tools = {
        guardedTool: tool({
          inputSchema: z.object({ value: z.string() }),
          contextSchema: z.object({ apiKey: z.string() }),
          needsApproval,
          execute: async ({ value }) => `${value}-result`,
        }),
      };

      const inputStream = convertArrayToReadableStream<
        LanguageModelStreamPart<typeof tools>
      >([
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'guardedTool',
          input: { value: 'test' },
        },
        finishChunk,
      ]);

      const transformedStream = executeToolsFromStream({
        stream: inputStream,
        generateId: mockId({ prefix: 'id' }),
        tools,
        callId: 'test-telemetry-call-id',
        messages: [],
        abortSignal: undefined,
        timeout: undefined,
        toolsContext: {
          guardedTool: { apiKey: 123 } as any,
        },
        runtimeContext: {},
      });

      try {
        await convertReadableStreamToArray(transformedStream);
        expect.unreachable('expected stream consumption to throw');
      } catch (error) {
        expect(needsApproval).not.toHaveBeenCalled();
        expect(TypeValidationError.isInstance(error)).toBe(true);

        if (TypeValidationError.isInstance(error)) {
          expect(error.value).toEqual({ apiKey: 123 });
          expect(error.context).toEqual({
            field: 'tool context',
            entityName: 'guardedTool',
          });
        }
      }
    });

    it('should handle error thrown in async tool execution', async () => {
      const tools = {
        failingTool: tool({
          inputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => {
            await delay(10);
            if (value === 'test') {
              throw toolError;
            }
            return 'test-result';
          },
        }),
      };

      const inputStream: ReadableStream<LanguageModelStreamPart<typeof tools>> =
        convertArrayToReadableStream([
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'failingTool',
            input: { value: 'test' },
          },
          finishChunk,
        ]);

      const toolError = new Error('Tool execution failed!');

      const transformedStream = executeToolsFromStream({
        stream: inputStream,
        generateId: mockId({ prefix: 'id' }),
        tools,
        callId: 'test-telemetry-call-id',
        messages: [],
        abortSignal: undefined,
        timeout: undefined,
        toolsContext: {},
        runtimeContext: {},
      });

      const resultPromise = convertReadableStreamToArray(transformedStream);
      await vi.advanceTimersByTimeAsync(10);
      const result = await resultPromise;

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "input": {
              "value": "test",
            },
            "toolCallId": "call-1",
            "toolName": "failingTool",
            "type": "tool-call",
          },
          {
            "finishReason": "stop",
            "performance": {
              "effectiveOutputTokensPerSecond": 0,
              "effectiveTotalTokensPerSecond": 0,
              "inputTokensPerSecond": undefined,
              "outputTokensPerSecond": undefined,
              "responseTimeMs": 0,
              "timeToFirstOutputMs": undefined,
            },
            "rawFinishReason": "stop",
            "type": "model-call-end",
            "usage": {
              "inputTokenDetails": {
                "cacheReadTokens": undefined,
                "cacheWriteTokens": undefined,
                "noCacheTokens": 3,
              },
              "inputTokens": 3,
              "outputTokenDetails": {
                "reasoningTokens": undefined,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "raw": undefined,
              "totalTokens": 13,
            },
          },
          {
            "toolCallId": "call-1",
            "toolExecutionMs": 0,
            "type": "tool-execution-end",
          },
          {
            "dynamic": false,
            "error": [Error: Tool execution failed!],
            "input": {
              "value": "test",
            },
            "toolCallId": "call-1",
            "toolName": "failingTool",
            "type": "tool-error",
          },
        ]
      `);
    });

    it('should handle error thrown in sync tool execution', async () => {
      const tools = {
        failingTool: tool({
          inputSchema: z.object({ value: z.string() }),
          execute: ({ value }) => {
            if (value === 'test') {
              throw toolError;
            }
            return 'test-result';
          },
        }),
      };

      const inputStream: ReadableStream<LanguageModelStreamPart<typeof tools>> =
        convertArrayToReadableStream([
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'failingTool',
            input: { value: 'test' },
          },
          finishChunk,
        ]);

      const toolError = new Error('Sync tool failed!');

      const transformedStream = executeToolsFromStream({
        stream: inputStream,
        generateId: mockId({ prefix: 'id' }),
        tools,
        callId: 'test-telemetry-call-id',
        messages: [],
        abortSignal: undefined,
        toolsContext: {},
        runtimeContext: {},
      });

      const result = await convertReadableStreamToArray(transformedStream);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "input": {
              "value": "test",
            },
            "toolCallId": "call-1",
            "toolName": "failingTool",
            "type": "tool-call",
          },
          {
            "finishReason": "stop",
            "performance": {
              "effectiveOutputTokensPerSecond": 0,
              "effectiveTotalTokensPerSecond": 0,
              "inputTokensPerSecond": undefined,
              "outputTokensPerSecond": undefined,
              "responseTimeMs": 0,
              "timeToFirstOutputMs": undefined,
            },
            "rawFinishReason": "stop",
            "type": "model-call-end",
            "usage": {
              "inputTokenDetails": {
                "cacheReadTokens": undefined,
                "cacheWriteTokens": undefined,
                "noCacheTokens": 3,
              },
              "inputTokens": 3,
              "outputTokenDetails": {
                "reasoningTokens": undefined,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "raw": undefined,
              "totalTokens": 13,
            },
          },
          {
            "toolCallId": "call-1",
            "toolExecutionMs": 0,
            "type": "tool-execution-end",
          },
          {
            "dynamic": false,
            "error": [Error: Sync tool failed!],
            "input": {
              "value": "test",
            },
            "toolCallId": "call-1",
            "toolName": "failingTool",
            "type": "tool-error",
          },
        ]
      `);
    });
  });
});
