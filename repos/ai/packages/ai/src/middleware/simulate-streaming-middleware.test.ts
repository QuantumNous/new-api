import type { LanguageModelV4Usage } from '@ai-sdk/provider';
import { jsonSchema, tool } from '@ai-sdk/provider-utils';
import {
  convertAsyncIterableToArray,
  mockId,
} from '@ai-sdk/provider-utils/test';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  vitest,
} from 'vitest';
import { streamText } from '../generate-text';
import * as logWarningsModule from '../logger/log-warnings';
import { wrapLanguageModel } from '../middleware/wrap-language-model';
import { MockLanguageModelV4 } from '../test/mock-language-model-v4';
import { simulateStreamingMiddleware } from './simulate-streaming-middleware';

const DEFAULT_SETTINGs = {
  prompt: 'Test prompt',
  experimental_generateMessageId: mockId({ prefix: 'msg' }),
  _internal: {
    generateId: mockId({ prefix: 'id' }),
  },
};

const testUsage: LanguageModelV4Usage = {
  inputTokens: {
    total: 5,
    noCache: 5,
    cacheRead: 0,
    cacheWrite: 0,
  },
  outputTokens: {
    total: 10,
    text: 10,
    reasoning: 3,
  },
};

describe('simulateStreamingMiddleware', () => {
  let logWarningsSpy: ReturnType<typeof vitest.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01'));
    logWarningsSpy = vitest
      .spyOn(logWarningsModule, 'logWarnings')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    logWarningsSpy.mockRestore();
  });

  it('should simulate streaming with text response', async () => {
    const mockModel = new MockLanguageModelV4({
      async doGenerate() {
        return {
          content: [{ type: 'text', text: 'This is a test response' }],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: testUsage,
          warnings: [],
        };
      },
    });

    const result = streamText({
      model: wrapLanguageModel({
        model: mockModel,
        middleware: simulateStreamingMiddleware(),
      }),
      ...DEFAULT_SETTINGs,
    });

    expect(await convertAsyncIterableToArray(result.stream))
      .toMatchInlineSnapshot(`
        [
          {
            "type": "start",
          },
          {
            "request": {
              "body": undefined,
              "messages": undefined,
            },
            "type": "start-step",
            "warnings": [],
          },
          {
            "id": "0",
            "type": "text-start",
          },
          {
            "id": "0",
            "providerMetadata": undefined,
            "text": "This is a test response",
            "type": "text-delta",
          },
          {
            "id": "0",
            "type": "text-end",
          },
          {
            "finishReason": "stop",
            "performance": {
              "effectiveOutputTokensPerSecond": 0,
              "effectiveTotalTokensPerSecond": 0,
              "inputTokensPerSecond": 0,
              "outputTokensPerSecond": 0,
              "responseTimeMs": 0,
              "stepTimeMs": 0,
              "timeBetweenOutputChunksMs": undefined,
              "timeToFirstOutputMs": 0,
              "toolExecutionMs": {},
            },
            "providerMetadata": undefined,
            "rawFinishReason": "stop",
            "response": {
              "headers": undefined,
              "id": "id-0",
              "modelId": "mock-model-id",
              "timestamp": 2025-01-01T00:00:00.000Z,
            },
            "type": "finish-step",
            "usage": {
              "inputTokenDetails": {
                "cacheReadTokens": 0,
                "cacheWriteTokens": 0,
                "noCacheTokens": 5,
              },
              "inputTokens": 5,
              "outputTokenDetails": {
                "reasoningTokens": 3,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "raw": undefined,
              "totalTokens": 15,
            },
          },
          {
            "finishReason": "stop",
            "rawFinishReason": "stop",
            "totalUsage": {
              "inputTokenDetails": {
                "cacheReadTokens": 0,
                "cacheWriteTokens": 0,
                "noCacheTokens": 5,
              },
              "inputTokens": 5,
              "outputTokenDetails": {
                "reasoningTokens": 3,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "totalTokens": 15,
            },
            "type": "finish",
          },
        ]
      `);
  });

  it('should simulate streaming with reasoning as string', async () => {
    const mockModel = new MockLanguageModelV4({
      async doGenerate() {
        return {
          content: [
            {
              type: 'reasoning',
              reasoningType: 'text',
              text: 'This is the reasoning process',
            },
            { type: 'text', text: 'This is a test response' },
          ],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: testUsage,
          warnings: [],
        };
      },
    });

    const result = streamText({
      model: wrapLanguageModel({
        model: mockModel,
        middleware: simulateStreamingMiddleware(),
      }),
      ...DEFAULT_SETTINGs,
    });

    expect(await convertAsyncIterableToArray(result.stream))
      .toMatchInlineSnapshot(`
        [
          {
            "type": "start",
          },
          {
            "request": {
              "body": undefined,
              "messages": undefined,
            },
            "type": "start-step",
            "warnings": [],
          },
          {
            "id": "0",
            "providerMetadata": undefined,
            "type": "reasoning-start",
          },
          {
            "id": "0",
            "providerMetadata": undefined,
            "text": "This is the reasoning process",
            "type": "reasoning-delta",
          },
          {
            "id": "0",
            "type": "reasoning-end",
          },
          {
            "id": "1",
            "type": "text-start",
          },
          {
            "id": "1",
            "providerMetadata": undefined,
            "text": "This is a test response",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
          {
            "finishReason": "stop",
            "performance": {
              "effectiveOutputTokensPerSecond": 0,
              "effectiveTotalTokensPerSecond": 0,
              "inputTokensPerSecond": 0,
              "outputTokensPerSecond": 0,
              "responseTimeMs": 0,
              "stepTimeMs": 0,
              "timeBetweenOutputChunksMs": {
                "avg": 0,
                "max": 0,
                "median": 0,
                "min": 0,
                "p10": 0,
                "p90": 0,
              },
              "timeToFirstOutputMs": 0,
              "toolExecutionMs": {},
            },
            "providerMetadata": undefined,
            "rawFinishReason": "stop",
            "response": {
              "headers": undefined,
              "id": "id-1",
              "modelId": "mock-model-id",
              "timestamp": 2025-01-01T00:00:00.000Z,
            },
            "type": "finish-step",
            "usage": {
              "inputTokenDetails": {
                "cacheReadTokens": 0,
                "cacheWriteTokens": 0,
                "noCacheTokens": 5,
              },
              "inputTokens": 5,
              "outputTokenDetails": {
                "reasoningTokens": 3,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "raw": undefined,
              "totalTokens": 15,
            },
          },
          {
            "finishReason": "stop",
            "rawFinishReason": "stop",
            "totalUsage": {
              "inputTokenDetails": {
                "cacheReadTokens": 0,
                "cacheWriteTokens": 0,
                "noCacheTokens": 5,
              },
              "inputTokens": 5,
              "outputTokenDetails": {
                "reasoningTokens": 3,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "totalTokens": 15,
            },
            "type": "finish",
          },
        ]
      `);
  });

  it('should simulate streaming with reasoning as array of text objects', async () => {
    const mockModel = new MockLanguageModelV4({
      async doGenerate() {
        return {
          content: [
            { type: 'text', text: 'This is a test response' },
            {
              type: 'reasoning',
              text: 'First reasoning step',
            },
            {
              type: 'reasoning',
              text: 'Second reasoning step',
            },
            {
              type: 'reasoning',
              text: '',
              providerMetadata: {
                testProvider: {
                  signature: 'abc',
                },
              },
            },
          ],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: testUsage,
          warnings: [],
        };
      },
    });

    const result = streamText({
      model: wrapLanguageModel({
        model: mockModel,
        middleware: simulateStreamingMiddleware(),
      }),
      ...DEFAULT_SETTINGs,
    });

    expect(await convertAsyncIterableToArray(result.stream))
      .toMatchInlineSnapshot(`
        [
          {
            "type": "start",
          },
          {
            "request": {
              "body": undefined,
              "messages": undefined,
            },
            "type": "start-step",
            "warnings": [],
          },
          {
            "id": "0",
            "type": "text-start",
          },
          {
            "id": "0",
            "providerMetadata": undefined,
            "text": "This is a test response",
            "type": "text-delta",
          },
          {
            "id": "0",
            "type": "text-end",
          },
          {
            "id": "1",
            "providerMetadata": undefined,
            "type": "reasoning-start",
          },
          {
            "id": "1",
            "providerMetadata": undefined,
            "text": "First reasoning step",
            "type": "reasoning-delta",
          },
          {
            "id": "1",
            "type": "reasoning-end",
          },
          {
            "id": "2",
            "providerMetadata": undefined,
            "type": "reasoning-start",
          },
          {
            "id": "2",
            "providerMetadata": undefined,
            "text": "Second reasoning step",
            "type": "reasoning-delta",
          },
          {
            "id": "2",
            "type": "reasoning-end",
          },
          {
            "id": "3",
            "providerMetadata": {
              "testProvider": {
                "signature": "abc",
              },
            },
            "type": "reasoning-start",
          },
          {
            "id": "3",
            "providerMetadata": undefined,
            "text": "",
            "type": "reasoning-delta",
          },
          {
            "id": "3",
            "type": "reasoning-end",
          },
          {
            "finishReason": "stop",
            "performance": {
              "effectiveOutputTokensPerSecond": 0,
              "effectiveTotalTokensPerSecond": 0,
              "inputTokensPerSecond": 0,
              "outputTokensPerSecond": 0,
              "responseTimeMs": 0,
              "stepTimeMs": 0,
              "timeBetweenOutputChunksMs": {
                "avg": 0,
                "max": 0,
                "median": 0,
                "min": 0,
                "p10": 0,
                "p90": 0,
              },
              "timeToFirstOutputMs": 0,
              "toolExecutionMs": {},
            },
            "providerMetadata": undefined,
            "rawFinishReason": "stop",
            "response": {
              "headers": undefined,
              "id": "id-2",
              "modelId": "mock-model-id",
              "timestamp": 2025-01-01T00:00:00.000Z,
            },
            "type": "finish-step",
            "usage": {
              "inputTokenDetails": {
                "cacheReadTokens": 0,
                "cacheWriteTokens": 0,
                "noCacheTokens": 5,
              },
              "inputTokens": 5,
              "outputTokenDetails": {
                "reasoningTokens": 3,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "raw": undefined,
              "totalTokens": 15,
            },
          },
          {
            "finishReason": "stop",
            "rawFinishReason": "stop",
            "totalUsage": {
              "inputTokenDetails": {
                "cacheReadTokens": 0,
                "cacheWriteTokens": 0,
                "noCacheTokens": 5,
              },
              "inputTokens": 5,
              "outputTokenDetails": {
                "reasoningTokens": 3,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "totalTokens": 15,
            },
            "type": "finish",
          },
        ]
      `);
  });

  it('should simulate streaming with reasoning as array of mixed objects', async () => {
    const mockModel = new MockLanguageModelV4({
      async doGenerate() {
        return {
          content: [
            {
              type: 'reasoning',
              text: 'First reasoning step',
            },
            {
              type: 'reasoning',
              text: 'data',
              providerMetadata: {
                testProvider: { isRedacted: true },
              },
            },
            {
              type: 'text',
              text: 'This is a test response',
            },
          ],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: testUsage,
          warnings: [],
        };
      },
    });

    const result = streamText({
      model: wrapLanguageModel({
        model: mockModel,
        middleware: simulateStreamingMiddleware(),
      }),
      ...DEFAULT_SETTINGs,
    });

    expect(await convertAsyncIterableToArray(result.stream))
      .toMatchInlineSnapshot(`
        [
          {
            "type": "start",
          },
          {
            "request": {
              "body": undefined,
              "messages": undefined,
            },
            "type": "start-step",
            "warnings": [],
          },
          {
            "id": "0",
            "providerMetadata": undefined,
            "type": "reasoning-start",
          },
          {
            "id": "0",
            "providerMetadata": undefined,
            "text": "First reasoning step",
            "type": "reasoning-delta",
          },
          {
            "id": "0",
            "type": "reasoning-end",
          },
          {
            "id": "1",
            "providerMetadata": {
              "testProvider": {
                "isRedacted": true,
              },
            },
            "type": "reasoning-start",
          },
          {
            "id": "1",
            "providerMetadata": undefined,
            "text": "data",
            "type": "reasoning-delta",
          },
          {
            "id": "1",
            "type": "reasoning-end",
          },
          {
            "id": "2",
            "type": "text-start",
          },
          {
            "id": "2",
            "providerMetadata": undefined,
            "text": "This is a test response",
            "type": "text-delta",
          },
          {
            "id": "2",
            "type": "text-end",
          },
          {
            "finishReason": "stop",
            "performance": {
              "effectiveOutputTokensPerSecond": 0,
              "effectiveTotalTokensPerSecond": 0,
              "inputTokensPerSecond": 0,
              "outputTokensPerSecond": 0,
              "responseTimeMs": 0,
              "stepTimeMs": 0,
              "timeBetweenOutputChunksMs": {
                "avg": 0,
                "max": 0,
                "median": 0,
                "min": 0,
                "p10": 0,
                "p90": 0,
              },
              "timeToFirstOutputMs": 0,
              "toolExecutionMs": {},
            },
            "providerMetadata": undefined,
            "rawFinishReason": "stop",
            "response": {
              "headers": undefined,
              "id": "id-3",
              "modelId": "mock-model-id",
              "timestamp": 2025-01-01T00:00:00.000Z,
            },
            "type": "finish-step",
            "usage": {
              "inputTokenDetails": {
                "cacheReadTokens": 0,
                "cacheWriteTokens": 0,
                "noCacheTokens": 5,
              },
              "inputTokens": 5,
              "outputTokenDetails": {
                "reasoningTokens": 3,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "raw": undefined,
              "totalTokens": 15,
            },
          },
          {
            "finishReason": "stop",
            "rawFinishReason": "stop",
            "totalUsage": {
              "inputTokenDetails": {
                "cacheReadTokens": 0,
                "cacheWriteTokens": 0,
                "noCacheTokens": 5,
              },
              "inputTokens": 5,
              "outputTokenDetails": {
                "reasoningTokens": 3,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "totalTokens": 15,
            },
            "type": "finish",
          },
        ]
      `);
  });

  it('should simulate streaming with tool calls', async () => {
    const mockModel = new MockLanguageModelV4({
      async doGenerate() {
        return {
          content: [
            {
              type: 'text',
              text: 'This is a test response',
            },
            {
              type: 'tool-call',
              toolCallId: 'tool-1',
              toolName: 'calculator',
              input: '{"expression": "2+2"}',
              toolCallType: 'function',
            },
            {
              type: 'tool-call',
              toolCallId: 'tool-2',
              toolName: 'weather',
              input: '{"location": "New York"}',
              toolCallType: 'function',
            },
          ],
          finishReason: { unified: 'tool-calls', raw: undefined },
          usage: testUsage,
          warnings: [],
        };
      },
    });

    const result = streamText({
      model: wrapLanguageModel({
        model: mockModel,
        middleware: simulateStreamingMiddleware(),
      }),
      tools: {
        calculator: tool({
          inputSchema: jsonSchema<{ expression: string }>({
            type: 'object',
          }),
        }),
        weather: tool({
          inputSchema: jsonSchema<{ location: string }>({
            type: 'object',
          }),
        }),
      },
      ...DEFAULT_SETTINGs,
    });

    expect(await convertAsyncIterableToArray(result.stream))
      .toMatchInlineSnapshot(`
        [
          {
            "type": "start",
          },
          {
            "request": {
              "body": undefined,
              "messages": undefined,
            },
            "type": "start-step",
            "warnings": [],
          },
          {
            "id": "0",
            "type": "text-start",
          },
          {
            "id": "0",
            "providerMetadata": undefined,
            "text": "This is a test response",
            "type": "text-delta",
          },
          {
            "id": "0",
            "type": "text-end",
          },
          {
            "input": {
              "expression": "2+2",
            },
            "providerExecuted": undefined,
            "providerMetadata": undefined,
            "title": undefined,
            "toolCallId": "tool-1",
            "toolName": "calculator",
            "type": "tool-call",
          },
          {
            "input": {
              "location": "New York",
            },
            "providerExecuted": undefined,
            "providerMetadata": undefined,
            "title": undefined,
            "toolCallId": "tool-2",
            "toolName": "weather",
            "type": "tool-call",
          },
          {
            "finishReason": "tool-calls",
            "performance": {
              "effectiveOutputTokensPerSecond": 0,
              "effectiveTotalTokensPerSecond": 0,
              "inputTokensPerSecond": 0,
              "outputTokensPerSecond": 0,
              "responseTimeMs": 0,
              "stepTimeMs": 0,
              "timeBetweenOutputChunksMs": {
                "avg": 0,
                "max": 0,
                "median": 0,
                "min": 0,
                "p10": 0,
                "p90": 0,
              },
              "timeToFirstOutputMs": 0,
              "toolExecutionMs": {},
            },
            "providerMetadata": undefined,
            "rawFinishReason": undefined,
            "response": {
              "headers": undefined,
              "id": "id-4",
              "modelId": "mock-model-id",
              "timestamp": 2025-01-01T00:00:00.000Z,
            },
            "type": "finish-step",
            "usage": {
              "inputTokenDetails": {
                "cacheReadTokens": 0,
                "cacheWriteTokens": 0,
                "noCacheTokens": 5,
              },
              "inputTokens": 5,
              "outputTokenDetails": {
                "reasoningTokens": 3,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "raw": undefined,
              "totalTokens": 15,
            },
          },
          {
            "finishReason": "tool-calls",
            "rawFinishReason": undefined,
            "totalUsage": {
              "inputTokenDetails": {
                "cacheReadTokens": 0,
                "cacheWriteTokens": 0,
                "noCacheTokens": 5,
              },
              "inputTokens": 5,
              "outputTokenDetails": {
                "reasoningTokens": 3,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "totalTokens": 15,
            },
            "type": "finish",
          },
        ]
      `);
  });

  it('should preserve additional metadata in the response', async () => {
    const mockModel = new MockLanguageModelV4({
      async doGenerate() {
        return {
          content: [{ type: 'text', text: 'This is a test response' }],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: testUsage,
          providerMetadata: { custom: { key: 'value' } },
          warnings: [],
        };
      },
    });

    const result = streamText({
      model: wrapLanguageModel({
        model: mockModel,
        middleware: simulateStreamingMiddleware(),
      }),
      ...DEFAULT_SETTINGs,
    });

    expect(await convertAsyncIterableToArray(result.stream))
      .toMatchInlineSnapshot(`
        [
          {
            "type": "start",
          },
          {
            "request": {
              "body": undefined,
              "messages": undefined,
            },
            "type": "start-step",
            "warnings": [],
          },
          {
            "id": "0",
            "type": "text-start",
          },
          {
            "id": "0",
            "providerMetadata": undefined,
            "text": "This is a test response",
            "type": "text-delta",
          },
          {
            "id": "0",
            "type": "text-end",
          },
          {
            "finishReason": "stop",
            "performance": {
              "effectiveOutputTokensPerSecond": 0,
              "effectiveTotalTokensPerSecond": 0,
              "inputTokensPerSecond": 0,
              "outputTokensPerSecond": 0,
              "responseTimeMs": 0,
              "stepTimeMs": 0,
              "timeBetweenOutputChunksMs": undefined,
              "timeToFirstOutputMs": 0,
              "toolExecutionMs": {},
            },
            "providerMetadata": {
              "custom": {
                "key": "value",
              },
            },
            "rawFinishReason": "stop",
            "response": {
              "headers": undefined,
              "id": "id-5",
              "modelId": "mock-model-id",
              "timestamp": 2025-01-01T00:00:00.000Z,
            },
            "type": "finish-step",
            "usage": {
              "inputTokenDetails": {
                "cacheReadTokens": 0,
                "cacheWriteTokens": 0,
                "noCacheTokens": 5,
              },
              "inputTokens": 5,
              "outputTokenDetails": {
                "reasoningTokens": 3,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "raw": undefined,
              "totalTokens": 15,
            },
          },
          {
            "finishReason": "stop",
            "rawFinishReason": "stop",
            "totalUsage": {
              "inputTokenDetails": {
                "cacheReadTokens": 0,
                "cacheWriteTokens": 0,
                "noCacheTokens": 5,
              },
              "inputTokens": 5,
              "outputTokenDetails": {
                "reasoningTokens": 3,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "totalTokens": 15,
            },
            "type": "finish",
          },
        ]
      `);
  });

  it('should handle empty text response', async () => {
    const mockModel = new MockLanguageModelV4({
      async doGenerate() {
        return {
          content: [{ type: 'text', text: '' }],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: testUsage,
          warnings: [],
        };
      },
    });

    const result = streamText({
      model: wrapLanguageModel({
        model: mockModel,
        middleware: simulateStreamingMiddleware(),
      }),
      ...DEFAULT_SETTINGs,
    });

    expect(await convertAsyncIterableToArray(result.stream)).toMatchSnapshot();
  });

  it('should pass through warnings from the model', async () => {
    const mockModel = new MockLanguageModelV4({
      async doGenerate() {
        return {
          content: [{ type: 'text', text: 'This is a test response' }],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: testUsage,
          warnings: [
            { type: 'other', message: 'Test warning', code: 'test_warning' },
          ],
        };
      },
    });

    const result = streamText({
      model: wrapLanguageModel({
        model: mockModel,
        middleware: simulateStreamingMiddleware(),
      }),
      ...DEFAULT_SETTINGs,
    });

    result.consumeStream();

    expect(await result.warnings).toMatchInlineSnapshot(`
      [
        {
          "code": "test_warning",
          "message": "Test warning",
          "type": "other",
        },
      ]
    `);
  });
});
