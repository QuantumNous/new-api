import {
  APICallError,
  type LanguageModelV4,
  type LanguageModelV4CallOptions,
  type LanguageModelV4FunctionTool,
  type LanguageModelV4Prompt,
  type LanguageModelV4ProviderTool,
  type LanguageModelV4StreamPart,
  type LanguageModelV4Usage,
  type SharedV4ProviderMetadata,
  type SharedV4Warning,
} from '@ai-sdk/provider';
import {
  delay,
  DelayedPromise,
  dynamicTool,
  jsonSchema,
  tool,
  type ToolSet,
  type ModelMessage,
  type Experimental_SandboxSession as SandboxSession,
  type Tool,
  type ToolExecuteFunction,
} from '@ai-sdk/provider-utils';
import {
  convertArrayToReadableStream,
  convertAsyncIterableToArray,
  convertReadableStreamToArray,
  convertResponseStreamToArray,
  isNodeVersionAtLeast,
  mockId,
} from '@ai-sdk/provider-utils/test';
import assert from 'node:assert';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  vitest,
} from 'vitest';
import { mockSandboxSessionFileStubs } from '../test/mock-sandbox';
import { z } from 'zod/v4';
import { Output, type LanguageModelCallEndEvent, type Telemetry } from '..';
import * as logWarningsModule from '../logger/log-warnings';
import type { Instructions } from '../prompt';
import { MockLanguageModelV4 } from '../test/mock-language-model-v4';
import { createMockServerResponse } from '../test/mock-server-response';
import { mockValues } from '../test/mock-values';
import {
  asLanguageModelUsage,
  createNullLanguageModelUsage,
} from '../types/usage';
import type { StepResult } from './step-result';
import { isLoopFinished, isStepCount } from './stop-condition';
import { streamText } from './stream-text';
import type { StreamTextResult, TextStreamPart } from './stream-text-result';
import type {
  OnToolExecutionEndCallback,
  OnToolExecutionStartCallback,
} from './tool-execution-events';
import type {
  GenerateTextOnEndCallback,
  GenerateTextOnStartCallback,
  GenerateTextOnStepStartCallback,
} from './generate-text-events';

const defaultSettings = () =>
  ({
    prompt: 'prompt',
    experimental_generateMessageId: mockId({ prefix: 'msg' }),
    _internal: {
      generateId: mockId({ prefix: 'id' }),
      generateCallId: () => 'test-telemetry-call-id',
    },
    onError: () => {},
  }) as const;

type ObjectPrototypeState = {
  providerMetadata?: unknown;
  text?: unknown;
};

function clearObjectPrototypeState() {
  const objectPrototype = Object.prototype as ObjectPrototypeState;
  delete objectPrototype.providerMetadata;
  delete objectPrototype.text;
}

const testUsage: LanguageModelV4Usage = {
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
};

const testUsage2: LanguageModelV4Usage = {
  inputTokens: {
    total: 3,
    noCache: 3,
    cacheRead: 0,
    cacheWrite: 0,
  },
  outputTokens: {
    total: 10,
    text: 10,
    reasoning: 10,
  },
};

function createTestModel({
  warnings = [],
  stream = convertArrayToReadableStream([
    {
      type: 'stream-start',
      warnings,
    },
    {
      type: 'response-metadata',
      id: 'id-0',
      modelId: 'mock-model-id',
      timestamp: new Date(0),
    },
    { type: 'text-start', id: '1' },
    { type: 'text-delta', id: '1', delta: 'Hello' },
    { type: 'text-delta', id: '1', delta: ', ' },
    { type: 'text-delta', id: '1', delta: `world!` },
    { type: 'text-end', id: '1' },
    {
      type: 'finish',
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: testUsage,
      providerMetadata: {
        testProvider: { testKey: 'testValue' },
      },
    },
  ]),
  request = undefined,
  response = undefined,
}: {
  stream?: ReadableStream<LanguageModelV4StreamPart>;
  request?: { body: string };
  response?: { headers: Record<string, string> };
  warnings?: SharedV4Warning[];
} = {}): LanguageModelV4 {
  return new MockLanguageModelV4({
    doStream: async () => ({ stream, request, response, warnings }),
  });
}

const modelWithSources = new MockLanguageModelV4({
  doStream: async () => ({
    stream: convertArrayToReadableStream([
      {
        type: 'source',
        sourceType: 'url',
        id: '123',
        url: 'https://example.com',
        title: 'Example',
        providerMetadata: { provider: { custom: 'value' } },
      },
      { type: 'text-start', id: '1' },
      { type: 'text-delta', id: '1', delta: 'Hello!' },
      { type: 'text-end', id: '1' },
      {
        type: 'source',
        sourceType: 'url',
        id: '456',
        url: 'https://example.com/2',
        title: 'Example 2',
        providerMetadata: { provider: { custom: 'value2' } },
      },
      {
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: testUsage,
      },
    ]),
  }),
});

const modelWithCustom = new MockLanguageModelV4({
  doStream: async () => ({
    stream: convertArrayToReadableStream([
      { type: 'text-start', id: '1' },
      { type: 'text-delta', id: '1', delta: 'Hello!' },
      { type: 'text-end', id: '1' },
      {
        type: 'custom',
        kind: 'openai.compaction',
        providerMetadata: {
          openai: { itemId: 'cmp_123' },
        },
      },
      {
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: testUsage,
      },
    ]),
  }),
});

const modelWithDocumentSources = new MockLanguageModelV4({
  doStream: async () => ({
    stream: convertArrayToReadableStream([
      {
        type: 'source',
        sourceType: 'document',
        id: 'doc-123',
        mediaType: 'application/pdf',
        title: 'Document Example',
        filename: 'example.pdf',
        providerMetadata: { provider: { custom: 'doc-value' } },
      },
      { type: 'text-start', id: '1' },
      { type: 'text-delta', id: '1', delta: 'Hello from document!' },
      { type: 'text-end', id: '1' },
      {
        type: 'source',
        sourceType: 'document',
        id: 'doc-456',
        mediaType: 'text/plain',
        title: 'Text Document',
        providerMetadata: { provider: { custom: 'doc-value2' } },
      },
      {
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: testUsage,
      },
    ]),
  }),
});

const modelWithFiles = new MockLanguageModelV4({
  doStream: async () => ({
    stream: convertArrayToReadableStream([
      {
        type: 'file',
        data: { type: 'data', data: 'Hello World' },
        mediaType: 'text/plain',
      },
      { type: 'text-start', id: '1' },
      { type: 'text-delta', id: '1', delta: 'Hello!' },
      { type: 'text-end', id: '1' },
      {
        type: 'file',
        data: { type: 'data', data: 'QkFVRw==' },
        mediaType: 'image/jpeg',
      },
      {
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: testUsage,
      },
    ]),
  }),
});

const modelWithFilesAndProviderMetadata = new MockLanguageModelV4({
  doStream: async () => ({
    stream: convertArrayToReadableStream([
      {
        type: 'file',
        data: { type: 'data', data: 'Hello World' },
        mediaType: 'text/plain',
        providerMetadata: {
          testProvider: { signature: 'sig-1' },
        },
      },
      { type: 'text-start', id: '1' },
      { type: 'text-delta', id: '1', delta: 'Hello!' },
      { type: 'text-end', id: '1' },
      {
        type: 'file',
        data: { type: 'data', data: 'QkFVRw==' },
        mediaType: 'image/jpeg',
      },
      {
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: testUsage,
      },
    ]),
  }),
});

const modelWithReasoning = new MockLanguageModelV4({
  doStream: async () => ({
    stream: convertArrayToReadableStream([
      {
        type: 'response-metadata',
        id: 'id-0',
        modelId: 'mock-model-id',
        timestamp: new Date(0),
      },
      { type: 'reasoning-start', id: '1' },
      {
        type: 'reasoning-delta',
        id: '1',
        delta: 'I will open the conversation',
      },
      {
        type: 'reasoning-delta',
        id: '1',
        delta: ' with witty banter.',
      },
      {
        type: 'reasoning-delta',
        id: '1',
        delta: '',
        providerMetadata: {
          testProvider: { signature: '1234567890' },
        } as SharedV4ProviderMetadata,
      },
      { type: 'reasoning-end', id: '1' },
      {
        type: 'reasoning-start',
        id: '2',
        providerMetadata: {
          testProvider: { redactedData: 'redacted-reasoning-data' },
        },
      },
      { type: 'reasoning-end', id: '2' },
      { type: 'reasoning-start', id: '3' },
      {
        type: 'reasoning-delta',
        id: '3',
        delta: ' Once the user has relaxed,',
      },
      {
        type: 'reasoning-delta',
        id: '3',
        delta: ' I will pry for valuable information.',
      },
      {
        type: 'reasoning-end',
        id: '3',
        providerMetadata: {
          testProvider: { signature: '1234567890' },
        } as SharedV4ProviderMetadata,
      },
      {
        type: 'reasoning-start',
        id: '4',
        providerMetadata: {
          testProvider: { signature: '1234567890' },
        } as SharedV4ProviderMetadata,
      },
      {
        type: 'reasoning-delta',
        id: '4',
        delta: ' I need to think about',
      },
      {
        type: 'reasoning-delta',
        id: '4',
        delta: ' this problem carefully.',
      },
      {
        type: 'reasoning-start',
        id: '5',
        providerMetadata: {
          testProvider: { signature: '1234567890' },
        } as SharedV4ProviderMetadata,
      },
      {
        type: 'reasoning-delta',
        id: '5',
        delta: ' The best solution',
      },
      {
        type: 'reasoning-delta',
        id: '5',
        delta: ' requires careful',
      },
      {
        type: 'reasoning-delta',
        id: '5',
        delta: ' consideration of all factors.',
      },
      {
        type: 'reasoning-end',
        id: '4',
        providerMetadata: {
          testProvider: { signature: '0987654321' },
        } as SharedV4ProviderMetadata,
      },
      {
        type: 'reasoning-end',
        id: '5',
        providerMetadata: {
          testProvider: { signature: '0987654321' },
        } as SharedV4ProviderMetadata,
      },
      { type: 'text-start', id: '1' },
      { type: 'text-delta', id: '1', delta: 'Hi' },
      { type: 'text-delta', id: '1', delta: ' there!' },
      {
        type: 'text-end',
        id: '1',
        providerMetadata: {
          testProvider: { signature: '0987654321' },
        } as SharedV4ProviderMetadata,
      },
      {
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: testUsage,
      },
    ]),
  }),
});

const modelWithReasoningFiles = new MockLanguageModelV4({
  doStream: async () => ({
    stream: convertArrayToReadableStream([
      {
        type: 'response-metadata',
        id: 'id-0',
        modelId: 'mock-model-id',
        timestamp: new Date(0),
      },
      {
        type: 'reasoning-file',
        data: { type: 'data', data: 'reasoning-file-data-1' },
        mediaType: 'image/png',
      },
      { type: 'reasoning-start', id: '1' },
      {
        type: 'reasoning-delta',
        id: '1',
        delta: 'Some reasoning text.',
      },
      { type: 'reasoning-end', id: '1' },
      {
        type: 'reasoning-file',
        data: { type: 'data', data: 'reasoning-file-data-2' },
        mediaType: 'image/jpeg',
        providerMetadata: {
          testProvider: { signature: 'rf-sig-1' },
        },
      },
      { type: 'text-start', id: '1' },
      { type: 'text-delta', id: '1', delta: 'Hello!' },
      { type: 'text-end', id: '1' },
      {
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: testUsage,
      },
    ]),
  }),
});

describe('streamText', () => {
  let logWarningsSpy: ReturnType<typeof vitest.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(0));
    logWarningsSpy = vitest
      .spyOn(logWarningsModule, 'logWarnings')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    logWarningsSpy.mockRestore();
  });

  describe('telemetry model-call context', () => {
    it('should execute doStream inside executeLanguageModelCall context', async () => {
      let activeContext: string | undefined;
      let capturedContext: string | undefined;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            capturedContext = activeContext;

            return {
              stream: convertArrayToReadableStream([
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'done' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        telemetry: {
          isEnabled: true,
          integrations: {
            executeLanguageModelCall: async ({ callId, execute }) => {
              activeContext = callId;
              try {
                return await execute();
              } finally {
                activeContext = undefined;
              }
            },
          },
        },
        ...defaultSettings(),
      });

      await result.consumeStream();

      expect(capturedContext).toBe('test-telemetry-call-id');
    });
  });

  describe('result.textStream', () => {
    it('should send text deltas', async () => {
      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ prompt }) => {
            expect(prompt).toStrictEqual([
              {
                role: 'user',
                content: [{ type: 'text', text: 'test-input' }],
                providerOptions: undefined,
              },
            ]);

            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', ' },
                { type: 'text-delta', id: '1', delta: `world!` },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        prompt: 'test-input',
      });

      expect(
        await convertAsyncIterableToArray(result.textStream),
      ).toStrictEqual(['Hello', ', ', 'world!']);
    });

    it('should filter out empty text deltas', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-delta', id: '1', delta: '' },
            { type: 'text-delta', id: '1', delta: ', ' },
            { type: 'text-delta', id: '1', delta: '' },
            { type: 'text-delta', id: '1', delta: 'world!' },
            { type: 'text-delta', id: '1', delta: '' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        prompt: 'test-input',
      });

      expect(
        await convertAsyncIterableToArray(result.textStream),
      ).toMatchSnapshot();
    });

    it('should not include reasoning content in textStream', async () => {
      const result = streamText({
        model: modelWithReasoning,
        ...defaultSettings(),
      });

      expect(
        await convertAsyncIterableToArray(result.textStream),
      ).toMatchSnapshot();
    });
  });

  describe('result.fullStream (deprecated)', () => {
    it('should expose the same stream parts as result.stream', async () => {
      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
        }),
        prompt: 'test-input',
      });

      const parts = await convertAsyncIterableToArray(result.fullStream);

      expect(parts.map(part => part.type)).toStrictEqual([
        'start',
        'start-step',
        'text-start',
        'text-delta',
        'text-end',
        'finish-step',
        'finish',
      ]);
      expect(parts.find(part => part.type === 'text-delta')).toMatchObject({
        text: 'Hello',
      });
    });
  });

  describe('result.stream', () => {
    it('should send text deltas', async () => {
      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ prompt }) => {
            expect(prompt).toStrictEqual([
              {
                role: 'user',
                content: [{ type: 'text', text: 'test-input' }],
                providerOptions: undefined,
              },
            ]);

            return {
              stream: convertArrayToReadableStream([
                {
                  type: 'response-metadata',
                  id: 'response-id',
                  modelId: 'response-model-id',
                  timestamp: new Date(5000),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', ' },
                { type: 'text-delta', id: '1', delta: `world!` },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        prompt: 'test-input',
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
              "id": "1",
              "type": "text-start",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": "Hello",
              "type": "text-delta",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": ", ",
              "type": "text-delta",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": "world!",
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
                "id": "response-id",
                "modelId": "response-model-id",
                "timestamp": 1970-01-01T00:00:05.000Z,
              },
              "type": "finish-step",
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
              "finishReason": "stop",
              "rawFinishReason": "stop",
              "totalUsage": {
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
                "totalTokens": 13,
              },
              "type": "finish",
            },
          ]
        `);
    });

    it('should send reasoning deltas', async () => {
      const result = streamText({
        model: modelWithReasoning,
        ...defaultSettings(),
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
              "id": "1",
              "type": "reasoning-start",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": "I will open the conversation",
              "type": "reasoning-delta",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": " with witty banter.",
              "type": "reasoning-delta",
            },
            {
              "id": "1",
              "providerMetadata": {
                "testProvider": {
                  "signature": "1234567890",
                },
              },
              "text": "",
              "type": "reasoning-delta",
            },
            {
              "id": "1",
              "type": "reasoning-end",
            },
            {
              "id": "2",
              "providerMetadata": {
                "testProvider": {
                  "redactedData": "redacted-reasoning-data",
                },
              },
              "type": "reasoning-start",
            },
            {
              "id": "2",
              "type": "reasoning-end",
            },
            {
              "id": "3",
              "type": "reasoning-start",
            },
            {
              "id": "3",
              "providerMetadata": undefined,
              "text": " Once the user has relaxed,",
              "type": "reasoning-delta",
            },
            {
              "id": "3",
              "providerMetadata": undefined,
              "text": " I will pry for valuable information.",
              "type": "reasoning-delta",
            },
            {
              "id": "3",
              "providerMetadata": {
                "testProvider": {
                  "signature": "1234567890",
                },
              },
              "type": "reasoning-end",
            },
            {
              "id": "4",
              "providerMetadata": {
                "testProvider": {
                  "signature": "1234567890",
                },
              },
              "type": "reasoning-start",
            },
            {
              "id": "4",
              "providerMetadata": undefined,
              "text": " I need to think about",
              "type": "reasoning-delta",
            },
            {
              "id": "4",
              "providerMetadata": undefined,
              "text": " this problem carefully.",
              "type": "reasoning-delta",
            },
            {
              "id": "5",
              "providerMetadata": {
                "testProvider": {
                  "signature": "1234567890",
                },
              },
              "type": "reasoning-start",
            },
            {
              "id": "5",
              "providerMetadata": undefined,
              "text": " The best solution",
              "type": "reasoning-delta",
            },
            {
              "id": "5",
              "providerMetadata": undefined,
              "text": " requires careful",
              "type": "reasoning-delta",
            },
            {
              "id": "5",
              "providerMetadata": undefined,
              "text": " consideration of all factors.",
              "type": "reasoning-delta",
            },
            {
              "id": "4",
              "providerMetadata": {
                "testProvider": {
                  "signature": "0987654321",
                },
              },
              "type": "reasoning-end",
            },
            {
              "id": "5",
              "providerMetadata": {
                "testProvider": {
                  "signature": "0987654321",
                },
              },
              "type": "reasoning-end",
            },
            {
              "id": "1",
              "type": "text-start",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": "Hi",
              "type": "text-delta",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": " there!",
              "type": "text-delta",
            },
            {
              "id": "1",
              "providerMetadata": {
                "testProvider": {
                  "signature": "0987654321",
                },
              },
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
                "id": "id-0",
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "type": "finish-step",
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
              "finishReason": "stop",
              "rawFinishReason": "stop",
              "totalUsage": {
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
                "totalTokens": 13,
              },
              "type": "finish",
            },
          ]
        `);
    });

    it('should send sources', async () => {
      const result = streamText({
        model: modelWithSources,
        ...defaultSettings(),
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
              "id": "123",
              "providerMetadata": {
                "provider": {
                  "custom": "value",
                },
              },
              "sourceType": "url",
              "title": "Example",
              "type": "source",
              "url": "https://example.com",
            },
            {
              "id": "1",
              "type": "text-start",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": "Hello!",
              "type": "text-delta",
            },
            {
              "id": "1",
              "type": "text-end",
            },
            {
              "id": "456",
              "providerMetadata": {
                "provider": {
                  "custom": "value2",
                },
              },
              "sourceType": "url",
              "title": "Example 2",
              "type": "source",
              "url": "https://example.com/2",
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
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "type": "finish-step",
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
              "finishReason": "stop",
              "rawFinishReason": "stop",
              "totalUsage": {
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
                "totalTokens": 13,
              },
              "type": "finish",
            },
          ]
        `);
    });

    it('should send custom parts', async () => {
      const result = streamText({
        model: modelWithCustom,
        ...defaultSettings(),
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
              "id": "1",
              "type": "text-start",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": "Hello!",
              "type": "text-delta",
            },
            {
              "id": "1",
              "type": "text-end",
            },
            {
              "kind": "openai.compaction",
              "providerMetadata": {
                "openai": {
                  "itemId": "cmp_123",
                },
              },
              "type": "custom",
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
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "type": "finish-step",
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
              "finishReason": "stop",
              "rawFinishReason": "stop",
              "totalUsage": {
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
                "totalTokens": 13,
              },
              "type": "finish",
            },
          ]
        `);
    });

    it('should send files', async () => {
      const result = streamText({
        model: modelWithFiles,
        ...defaultSettings(),
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
              "file": DefaultGeneratedFileWithType {
                "base64Data": "Hello World",
                "mediaType": "text/plain",
                "type": "file",
                "uint8ArrayData": undefined,
              },
              "providerMetadata": undefined,
              "type": "file",
            },
            {
              "id": "1",
              "type": "text-start",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": "Hello!",
              "type": "text-delta",
            },
            {
              "id": "1",
              "type": "text-end",
            },
            {
              "file": DefaultGeneratedFileWithType {
                "base64Data": "QkFVRw==",
                "mediaType": "image/jpeg",
                "type": "file",
                "uint8ArrayData": undefined,
              },
              "providerMetadata": undefined,
              "type": "file",
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
                "id": "id-0",
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "type": "finish-step",
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
              "finishReason": "stop",
              "rawFinishReason": "stop",
              "totalUsage": {
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
                "totalTokens": 13,
              },
              "type": "finish",
            },
          ]
        `);
    });

    it('should send files with providerMetadata', async () => {
      const result = streamText({
        model: modelWithFilesAndProviderMetadata,
        ...defaultSettings(),
      });

      const parts = await convertAsyncIterableToArray(result.stream);
      const fileParts = parts.filter(p => p.type === 'file');

      expect(fileParts).toMatchInlineSnapshot(`
        [
          {
            "file": DefaultGeneratedFileWithType {
              "base64Data": "Hello World",
              "mediaType": "text/plain",
              "type": "file",
              "uint8ArrayData": undefined,
            },
            "providerMetadata": {
              "testProvider": {
                "signature": "sig-1",
              },
            },
            "type": "file",
          },
          {
            "file": DefaultGeneratedFileWithType {
              "base64Data": "QkFVRw==",
              "mediaType": "image/jpeg",
              "type": "file",
              "uint8ArrayData": undefined,
            },
            "providerMetadata": undefined,
            "type": "file",
          },
        ]
      `);
    });

    it('should send reasoning-files', async () => {
      const result = streamText({
        model: modelWithReasoningFiles,
        ...defaultSettings(),
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
              "file": DefaultGeneratedFileWithType {
                "base64Data": "reasoning-file-data-1",
                "mediaType": "image/png",
                "type": "file",
                "uint8ArrayData": undefined,
              },
              "providerMetadata": undefined,
              "type": "reasoning-file",
            },
            {
              "id": "1",
              "type": "reasoning-start",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": "Some reasoning text.",
              "type": "reasoning-delta",
            },
            {
              "id": "1",
              "type": "reasoning-end",
            },
            {
              "file": DefaultGeneratedFileWithType {
                "base64Data": "reasoning-file-data-2",
                "mediaType": "image/jpeg",
                "type": "file",
                "uint8ArrayData": undefined,
              },
              "providerMetadata": {
                "testProvider": {
                  "signature": "rf-sig-1",
                },
              },
              "type": "reasoning-file",
            },
            {
              "id": "1",
              "type": "text-start",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": "Hello!",
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
                "id": "id-0",
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "type": "finish-step",
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
              "finishReason": "stop",
              "rawFinishReason": "stop",
              "totalUsage": {
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
                "totalTokens": 13,
              },
              "type": "finish",
            },
          ]
        `);
    });

    it('should use fallback response metadata when response metadata is not provided', async () => {
      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ prompt }) => {
            expect(prompt).toStrictEqual([
              {
                role: 'user',
                content: [{ type: 'text', text: 'test-input' }],
                providerOptions: undefined,
              },
            ]);

            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', ' },
                { type: 'text-delta', id: '1', delta: `world!` },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        prompt: 'test-input',
        _internal: {
          generateId: mockValues('id-2000'),
          generateCallId: () => 'test-telemetry-call-id',
        },
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
              "id": "1",
              "type": "text-start",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": "Hello",
              "type": "text-delta",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": ", ",
              "type": "text-delta",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": "world!",
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
                "id": "id-2000",
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "type": "finish-step",
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
              "finishReason": "stop",
              "rawFinishReason": "stop",
              "totalUsage": {
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
                "totalTokens": 13,
              },
              "type": "finish",
            },
          ]
        `);
    });

    it('should send tool calls', async () => {
      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ prompt, tools, toolChoice }) => {
            expect(tools).toStrictEqual([
              {
                type: 'function',
                name: 'tool1',
                inputSchema: {
                  $schema: 'http://json-schema.org/draft-07/schema#',
                  additionalProperties: false,
                  properties: { value: { type: 'string' } },
                  required: ['value'],
                  type: 'object',
                },
              },
            ]);

            expect(toolChoice).toStrictEqual({ type: 'required' });

            expect(prompt).toStrictEqual([
              {
                role: 'user',
                content: [{ type: 'text', text: 'test-input' }],
                providerOptions: undefined,
              },
            ]);

            return {
              stream: convertArrayToReadableStream([
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                {
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  input: `{ "value": "value" }`,
                  providerMetadata: {
                    testProvider: {
                      signature: 'sig',
                    },
                  },
                },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        tools: {
          tool1: tool({
            title: 'Tool 1',
            inputSchema: z.object({ value: z.string() }),
          }),
        },
        toolChoice: 'required',
        prompt: 'test-input',
      });

      expect(
        await convertAsyncIterableToArray(result.stream),
      ).toMatchSnapshot();
    });

    it('should refine tool input before tool execution, stream parts, and callbacks', async () => {
      const modelCallEndEvents: LanguageModelCallEndEvent<any>[] = [];
      const toolExecutionStartEvents: Array<{
        toolCall: { input: unknown };
      }> = [];

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: `{ "value": " raw " }`,
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async input => {
              expect(input).toStrictEqual({ value: 'raw' });
              return `result:${input.value}`;
            },
          }),
        },
        experimental_refineToolInput: {
          tool1: input => ({ value: input.value.trim() }),
        },
        onLanguageModelCallEnd: event => {
          modelCallEndEvents.push(event);
        },
        onToolExecutionStart: event => {
          toolExecutionStartEvents.push(event);
        },
        prompt: 'test-input',
      });

      const stream = await convertAsyncIterableToArray(result.stream);

      expect(stream).toContainEqual(
        expect.objectContaining({
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'tool1',
          input: { value: 'raw' },
        }),
      );
      expect(stream).toContainEqual(
        expect.objectContaining({
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'tool1',
          input: { value: 'raw' },
          output: 'result:raw',
        }),
      );
      expect(modelCallEndEvents[0].content[0]).toMatchObject({
        type: 'tool-call',
        input: { value: 'raw' },
      });
      expect(toolExecutionStartEvents[0].toolCall.input).toStrictEqual({
        value: 'raw',
      });
    });

    it('should send tool call deltas', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            {
              type: 'tool-input-start',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              toolName: 'test-tool',
            },
            {
              type: 'tool-input-delta',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              delta: '{"',
            },
            {
              type: 'tool-input-delta',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              delta: 'value',
            },
            {
              type: 'tool-input-delta',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              delta: '":"',
            },
            {
              type: 'tool-input-delta',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              delta: 'Spark',
            },
            {
              type: 'tool-input-delta',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              delta: 'le',
            },
            {
              type: 'tool-input-delta',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              delta: ' Day',
            },
            {
              type: 'tool-input-delta',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              delta: '"}',
            },
            {
              type: 'tool-input-end',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
            },
            {
              type: 'tool-call',
              toolCallId: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              toolName: 'test-tool',
              input: '{"value":"Sparkle Day"}',
            },
            {
              type: 'finish',
              finishReason: { unified: 'tool-calls', raw: undefined },
              usage: testUsage2,
            },
          ]),
        }),
        tools: {
          'test-tool': tool({
            inputSchema: z.object({ value: z.string() }),
          }),
        },
        toolChoice: 'required',
        prompt: 'test-input',
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
              "dynamic": false,
              "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
              "title": undefined,
              "toolName": "test-tool",
              "type": "tool-input-start",
            },
            {
              "delta": "{"",
              "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
              "type": "tool-input-delta",
            },
            {
              "delta": "value",
              "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
              "type": "tool-input-delta",
            },
            {
              "delta": "":"",
              "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
              "type": "tool-input-delta",
            },
            {
              "delta": "Spark",
              "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
              "type": "tool-input-delta",
            },
            {
              "delta": "le",
              "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
              "type": "tool-input-delta",
            },
            {
              "delta": " Day",
              "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
              "type": "tool-input-delta",
            },
            {
              "delta": ""}",
              "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
              "type": "tool-input-delta",
            },
            {
              "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
              "type": "tool-input-end",
            },
            {
              "input": {
                "value": "Sparkle Day",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
              "toolName": "test-tool",
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
                "id": "id-0",
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "type": "finish-step",
              "usage": {
                "inputTokenDetails": {
                  "cacheReadTokens": 0,
                  "cacheWriteTokens": 0,
                  "noCacheTokens": 3,
                },
                "inputTokens": 3,
                "outputTokenDetails": {
                  "reasoningTokens": 10,
                  "textTokens": 10,
                },
                "outputTokens": 10,
                "raw": undefined,
                "totalTokens": 13,
              },
            },
            {
              "finishReason": "tool-calls",
              "rawFinishReason": undefined,
              "totalUsage": {
                "inputTokenDetails": {
                  "cacheReadTokens": 0,
                  "cacheWriteTokens": 0,
                  "noCacheTokens": 3,
                },
                "inputTokens": 3,
                "outputTokenDetails": {
                  "reasoningTokens": 10,
                  "textTokens": 10,
                },
                "outputTokens": 10,
                "totalTokens": 13,
              },
              "type": "finish",
            },
          ]
        `);
    });

    it('should pass through providerMetadata on tool-input-start', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            {
              type: 'tool-input-start',
              id: 'call-1',
              toolName: 'test-tool',
              providerMetadata: {
                testProvider: { someKey: 'someValue' },
              },
            },
            {
              type: 'tool-input-delta',
              id: 'call-1',
              delta: '{"value":"test"}',
            },
            {
              type: 'tool-input-end',
              id: 'call-1',
            },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'test-tool',
              input: '{"value":"test"}',
            },
            {
              type: 'finish',
              finishReason: { unified: 'tool-calls', raw: undefined },
              usage: testUsage2,
            },
          ]),
        }),
        tools: {
          'test-tool': tool({
            inputSchema: z.object({ value: z.string() }),
          }),
        },
        toolChoice: 'required',
        prompt: 'test-input',
      });

      const chunks = await convertAsyncIterableToArray(result.stream);
      const toolInputStart = chunks.find(
        (c): c is Extract<typeof c, { type: 'tool-input-start' }> =>
          c.type === 'tool-input-start',
      );

      expect(toolInputStart?.providerMetadata).toEqual({
        testProvider: { someKey: 'someValue' },
      });
    });

    it('should send tool results', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: `{ "value": "value" }`,
            },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        tools: {
          tool1: tool({
            title: 'Tool 1',
            inputSchema: z.object({ value: z.string() }),
            execute: async (input, options) => {
              expect(input).toStrictEqual({ value: 'value' });
              expect(options.messages).toStrictEqual([
                { role: 'user', content: 'test-input' },
              ]);
              return `${input.value}-result`;
            },
          }),
        },
        prompt: 'test-input',
      });

      expect(
        await convertAsyncIterableToArray(result.stream),
      ).toMatchSnapshot();
    });

    it('should send delayed asynchronous tool results', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: `{ "value": "value" }`,
            },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        tools: {
          tool1: {
            title: 'Tool 1',
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => {
              await delay(50); // delay to show bug where step finish is sent before tool result
              return `${value}-result`;
            },
          },
        },
        prompt: 'test-input',
      });

      expect(
        await convertAsyncIterableToArray(result.stream),
      ).toMatchSnapshot();
    });

    it('should filter out empty text deltas', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-delta', id: '1', delta: '' },
            { type: 'text-delta', id: '1', delta: ', ' },
            { type: 'text-delta', id: '1', delta: '' },
            { type: 'text-delta', id: '1', delta: 'world!' },
            { type: 'text-delta', id: '1', delta: '' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        prompt: 'test-input',
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
              "id": "1",
              "type": "text-start",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": "Hello",
              "type": "text-delta",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": ", ",
              "type": "text-delta",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": "world!",
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
                "id": "id-0",
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "type": "finish-step",
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
              "finishReason": "stop",
              "rawFinishReason": "stop",
              "totalUsage": {
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
                "totalTokens": 13,
              },
              "type": "finish",
            },
          ]
        `);
    });
  });

  describe('errors', () => {
    it('should swallow error to prevent server crash', async () => {
      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            throw new Error('test error');
          },
        }),
        prompt: 'test-input',
        onError: () => {},
      });

      expect(
        await convertAsyncIterableToArray(result.textStream),
      ).toMatchSnapshot();
    });

    it('should forward error in doStream as error stream part', async () => {
      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            throw new Error('test error');
          },
        }),
        prompt: 'test-input',
        onError: () => {},
      });

      expect(await convertAsyncIterableToArray(result.stream)).toStrictEqual([
        {
          type: 'start',
        },
        {
          type: 'error',
          error: new Error('test error'),
        },
      ]);
    });

    it('should not read Object.prototype for missing text part ids', async () => {
      clearObjectPrototypeState();
      const protoKey: string = '__proto__';

      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-delta', id: protoKey, delta: 'Hello' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        prompt: 'test-input',
        onError: () => {},
      });

      try {
        expect(await convertAsyncIterableToArray(result.stream)).toContainEqual(
          {
            type: 'error',
            error: `text part ${protoKey} not found`,
          },
        );

        expect(Object.hasOwn(Object.prototype, 'providerMetadata')).toBe(false);
        expect(Object.hasOwn(Object.prototype, 'text')).toBe(false);
      } finally {
        clearObjectPrototypeState();
      }
    });

    it('should not read Object.prototype for missing reasoning part ids', async () => {
      clearObjectPrototypeState();
      const protoKey: string = '__proto__';

      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'reasoning-delta', id: protoKey, delta: 'Thinking...' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        prompt: 'test-input',
        onError: () => {},
      });

      try {
        expect(await convertAsyncIterableToArray(result.stream)).toContainEqual(
          {
            type: 'error',
            error: `reasoning part ${protoKey} not found`,
          },
        );

        expect(Object.hasOwn(Object.prototype, 'providerMetadata')).toBe(false);
        expect(Object.hasOwn(Object.prototype, 'text')).toBe(false);
      } finally {
        clearObjectPrototypeState();
      }
    });

    it('should invoke onError callback when error is thrown', async () => {
      const onError = vi.fn();

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            throw new Error('test error');
          },
        }),
        prompt: 'test-input',
        onError,
      });

      await result.consumeStream();

      expect(onError).toHaveBeenCalledWith({
        error: new Error('test error'),
      });
    });

    it('should call onFinish even when error chunk occurs mid-stream', async () => {
      const onFinish = vi.fn();
      const onError = vi.fn();

      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'error', error: new Error('chunk error') },
            // Note: finish-step and finish are still added after error
            {
              type: 'finish',
              finishReason: { unified: 'error', raw: undefined },
              usage: testUsage,
            },
          ]),
        }),
        prompt: 'test-input',
        onError,
        onFinish,
      });

      await result.consumeStream();

      // Verify onError was called
      expect(onError).toHaveBeenCalledWith({
        error: new Error('chunk error'),
      });

      // Verify onFinish was still called after the error
      expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          finishReason: 'error',
          text: 'Hello',
          usage: asLanguageModelUsage(testUsage),
        }),
      );
    });

    it('should invoke onError callback when error is thrown in 2nd step', async () => {
      const onError = vi.fn();
      let responseCount = 0;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ prompt, tools, toolChoice }) => {
            if (responseCount++ === 0) {
              return {
                stream: convertArrayToReadableStream([
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolName: 'tool1',
                    input: `{ "value": "value" }`,
                  },
                  {
                    type: 'finish',
                    finishReason: { unified: 'tool-calls', raw: undefined },
                    usage: testUsage,
                  },
                ]),
                response: { headers: { call: '1' } },
              };
            }

            throw new Error('test error');
          },
        }),
        prompt: 'test-input',
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'result1',
          },
        },
        stopWhen: isStepCount(3),
        onError,
      });

      await result.consumeStream();

      expect(onError).toHaveBeenCalledWith({
        error: new Error('test error'),
      });
    });

    it('should reject text promise when error is thrown', async () => {
      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            throw new Error('test error');
          },
        }),
        prompt: 'test-input',
        onError: () => {},
      });

      await expect(result.text).rejects.toThrow(
        'No output generated. Check the stream for errors.',
      );
    });

    it('should reject when provider stream closes before finish chunk', async () => {
      const onError = vi.fn();
      const onStepFinish = vi.fn();

      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'stream-start',
              warnings: [],
            },
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
          ]),
        }),
        prompt: 'test-input',
        onError,
        onStepFinish,
      });

      await result.consumeStream();

      await expect(result.text).rejects.toThrow(
        'No output generated. The model stream ended without a finish chunk.',
      );
      await expect(result.steps).rejects.toThrow(
        'No output generated. The model stream ended without a finish chunk.',
      );
      await expect(result.finishReason).rejects.toThrow(
        'No output generated. The model stream ended without a finish chunk.',
      );
      await expect(result.totalUsage).rejects.toThrow(
        'No output generated. The model stream ended without a finish chunk.',
      );
      expect(onError).toHaveBeenCalledWith({
        error: expect.objectContaining({
          message:
            'No output generated. The model stream ended without a finish chunk.',
        }),
      });

      expect(onStepFinish).not.toHaveBeenCalled();
    });

    it('should resolve with partial output when provider stream closes before finish chunk after producing output', async () => {
      const onError = vi.fn();

      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'stream-start',
              warnings: [],
            },
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-delta', id: '1', delta: ', world' },
            // stream truncated: no text-end, no finish chunk
          ]),
        }),
        prompt: 'test-input',
        onError,
      });

      await result.consumeStream();

      expect(await result.text).toStrictEqual('Hello, world');
      expect(await result.finishReason).toStrictEqual('other');
      expect(await result.steps).toHaveLength(1);
      expect(onError).not.toHaveBeenCalled();
    });

    it('should reject result promises when provider stream errors after metadata', async () => {
      const onConsumeError = vi.fn();

      const result = streamText({
        model: createTestModel({
          stream: new ReadableStream<LanguageModelV4StreamPart>({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              });
              queueMicrotask(() => {
                controller.error(new Error('simulated provider stream error'));
              });
            },
          }),
        }),
        prompt: 'test-input',
      });

      await expect(
        result.consumeStream({ onError: onConsumeError }),
      ).resolves.not.toThrow();

      await expect(result.text).rejects.toThrow(
        'simulated provider stream error',
      );
      await expect(result.steps).rejects.toThrow(
        'simulated provider stream error',
      );
      await expect(result.finishReason).rejects.toThrow(
        'simulated provider stream error',
      );
      await expect(result.totalUsage).rejects.toThrow(
        'simulated provider stream error',
      );
      expect(onConsumeError).toHaveBeenCalledWith(
        new Error('simulated provider stream error'),
      );
    });

    it('should reject when provider stream is incomplete on a continuation step', async () => {
      const onError = vi.fn();
      const onStepFinish = vi.fn();
      let responseCount = 0;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  stream: convertArrayToReadableStream([
                    { type: 'stream-start', warnings: [] },
                    {
                      type: 'tool-call',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{}',
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'tool-calls', raw: undefined },
                      usage: testUsage,
                    },
                  ]),
                };
              case 1:
                // continuation step ends without a finish chunk:
                return {
                  stream: convertArrayToReadableStream([
                    { type: 'stream-start', warnings: [] },
                    {
                      type: 'response-metadata',
                      id: 'id-1',
                      modelId: 'mock-model-id',
                      timestamp: new Date(0),
                    },
                  ]),
                };
              default:
                throw new Error(`Unexpected response count: ${responseCount}`);
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({}),
            execute: async () => 'result1',
          }),
        },
        prompt: 'test-input',
        stopWhen: isStepCount(3),
        onError,
        onStepFinish,
      });

      await result.consumeStream();

      await expect(result.steps).rejects.toThrow(
        'No output generated. The model stream ended without a finish chunk.',
      );
      await expect(result.finishReason).rejects.toThrow(
        'No output generated. The model stream ended without a finish chunk.',
      );
      await expect(result.totalUsage).rejects.toThrow(
        'No output generated. The model stream ended without a finish chunk.',
      );
      expect(onError).toHaveBeenCalledWith({
        error: expect.objectContaining({
          message:
            'No output generated. The model stream ended without a finish chunk.',
        }),
      });

      expect(onStepFinish).toHaveBeenCalledTimes(1);
    });
  });

  describe('retries', () => {
    it('should preserve allowSystemInMessages when retrying after a 500 error', async () => {
      const doStream = vi
        .fn<LanguageModelV4['doStream']>()
        .mockImplementationOnce(async () => {
          throw new APICallError({
            message: 'Internal Server Error',
            url: 'https://api.example.com/v1/chat',
            requestBodyValues: { prompt: 'test-input' },
            statusCode: 500,
            responseHeaders: {
              'retry-after-ms': '1',
            },
          });
        })
        .mockImplementationOnce(async () => ({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'hello' },
            { type: 'text-delta', id: '1', delta: ' ' },
            { type: 'text-delta', id: '1', delta: 'world' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }));

      const model = new MockLanguageModelV4({ doStream });

      const result = streamText({
        model,
        allowSystemInMessages: true,
        messages: [
          { role: 'system', content: 'INSTRUCTIONS' },
          { role: 'user', content: 'test-input' },
        ],
      });

      const textStreamPromise = convertAsyncIterableToArray(result.textStream);

      await vi.advanceTimersByTimeAsync(1);

      expect(await textStreamPromise).toStrictEqual(['hello', ' ', 'world']);
      expect(doStream).toHaveBeenCalledTimes(2);
      expect(model.doStreamCalls[0].prompt).toEqual([
        {
          role: 'system',
          content: 'INSTRUCTIONS',
          providerOptions: undefined,
        },
        {
          role: 'user',
          content: [{ type: 'text', text: 'test-input' }],
          providerOptions: undefined,
        },
      ]);
      expect(model.doStreamCalls[1].prompt).toEqual(
        model.doStreamCalls[0].prompt,
      );
    });

    it('should retry after a 500 error and stream the successful response', async () => {
      const doStream = vi
        .fn<LanguageModelV4['doStream']>()
        .mockImplementationOnce(async () => {
          throw new APICallError({
            message: 'Internal Server Error',
            url: 'https://api.example.com/v1/chat',
            requestBodyValues: { prompt: 'test-input' },
            statusCode: 500,
            responseHeaders: {
              'retry-after-ms': '1',
            },
          });
        })
        .mockImplementationOnce(async () => ({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'hello' },
            { type: 'text-delta', id: '1', delta: ' ' },
            { type: 'text-delta', id: '1', delta: 'world' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }));

      const result = streamText({
        model: new MockLanguageModelV4({ doStream }),
        prompt: 'test-input',
      });

      const textStreamPromise = convertAsyncIterableToArray(result.textStream);

      await vi.advanceTimersByTimeAsync(1);

      expect(await textStreamPromise).toStrictEqual(['hello', ' ', 'world']);
      expect(doStream).toHaveBeenCalledTimes(2);
    });
  });

  describe('result.pipeUIMessageStreamToResponse', async () => {
    it('should write data stream parts to a Node.js response-like object', async () => {
      const mockResponse = createMockServerResponse();

      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        _internal: {
          generateId: mockId({ prefix: 'id' }),
          generateCallId: () => 'test-telemetry-call-id',
        },
      });

      result.pipeUIMessageStreamToResponse(mockResponse);

      await mockResponse.waitForEnd();

      expect(mockResponse.statusCode).toBe(200);
      expect(mockResponse.headers).toMatchInlineSnapshot(`
        {
          "cache-control": "no-cache",
          "connection": "keep-alive",
          "content-type": "text/event-stream",
          "x-accel-buffering": "no",
          "x-vercel-ai-ui-message-stream": "v1",
        }
      `);
      expect(mockResponse.getDecodedChunks()).toMatchInlineSnapshot(`
        [
          "data: {"type":"start"}

        ",
          "data: {"type":"start-step"}

        ",
          "data: {"type":"text-start","id":"1"}

        ",
          "data: {"type":"text-delta","id":"1","delta":"Hello"}

        ",
          "data: {"type":"text-delta","id":"1","delta":", "}

        ",
          "data: {"type":"text-delta","id":"1","delta":"world!"}

        ",
          "data: {"type":"text-end","id":"1"}

        ",
          "data: {"type":"finish-step"}

        ",
          "data: {"type":"finish","finishReason":"stop"}

        ",
          "data: [DONE]

        ",
        ]
      `);
    });

    it('should create a Response with a data stream and custom headers', async () => {
      const mockResponse = createMockServerResponse();

      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        _internal: {
          generateId: mockId({ prefix: 'id' }),
          generateCallId: () => 'test-telemetry-call-id',
        },
      });

      result.pipeUIMessageStreamToResponse(mockResponse, {
        status: 201,
        statusText: 'foo',
        headers: {
          'custom-header': 'custom-value',
        },
      });

      await mockResponse.waitForEnd();

      expect(mockResponse.statusCode).toBe(201);
      expect(mockResponse.statusMessage).toBe('foo');

      expect(mockResponse.headers).toMatchInlineSnapshot(`
        {
          "cache-control": "no-cache",
          "connection": "keep-alive",
          "content-type": "text/event-stream",
          "custom-header": "custom-value",
          "x-accel-buffering": "no",
          "x-vercel-ai-ui-message-stream": "v1",
        }
      `);

      expect(mockResponse.getDecodedChunks()).toMatchInlineSnapshot(`
        [
          "data: {"type":"start"}

        ",
          "data: {"type":"start-step"}

        ",
          "data: {"type":"text-start","id":"1"}

        ",
          "data: {"type":"text-delta","id":"1","delta":"Hello"}

        ",
          "data: {"type":"text-delta","id":"1","delta":", "}

        ",
          "data: {"type":"text-delta","id":"1","delta":"world!"}

        ",
          "data: {"type":"text-end","id":"1"}

        ",
          "data: {"type":"finish-step"}

        ",
          "data: {"type":"finish","finishReason":"stop"}

        ",
          "data: [DONE]

        ",
        ]
      `);
    });

    it('should mask error messages by default', async () => {
      const mockResponse = createMockServerResponse();

      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'error', error: 'error' },
          ]),
        }),
        prompt: 'test-input',
        _internal: {
          generateId: mockId({ prefix: 'id' }),
          generateCallId: () => 'test-telemetry-call-id',
        },
        onError: () => {},
      });

      result.pipeUIMessageStreamToResponse(mockResponse);

      await mockResponse.waitForEnd();

      expect(mockResponse.getDecodedChunks()).toMatchSnapshot();
    });

    it('should support custom error messages', async () => {
      const mockResponse = createMockServerResponse();

      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'error', error: 'error' },
          ]),
        }),
        prompt: 'test-input',
        _internal: {
          generateId: mockId({ prefix: 'id' }),
          generateCallId: () => 'test-telemetry-call-id',
        },
        onError: () => {},
      });

      result.pipeUIMessageStreamToResponse(mockResponse, {
        onError: error => `custom error message: ${error}`,
      });

      await mockResponse.waitForEnd();

      expect(mockResponse.getDecodedChunks()).toMatchSnapshot();
    });

    it('should omit message finish event (d:) when sendFinish is false', async () => {
      const mockResponse = createMockServerResponse();

      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello, World!' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        ...defaultSettings(),
      });

      result.pipeUIMessageStreamToResponse(mockResponse, { sendFinish: false });

      await mockResponse.waitForEnd();

      expect(mockResponse.getDecodedChunks()).toMatchInlineSnapshot(`
        [
          "data: {"type":"start"}

        ",
          "data: {"type":"start-step"}

        ",
          "data: {"type":"text-start","id":"1"}

        ",
          "data: {"type":"text-delta","id":"1","delta":"Hello, World!"}

        ",
          "data: {"type":"text-end","id":"1"}

        ",
          "data: {"type":"finish-step"}

        ",
          "data: [DONE]

        ",
        ]
      `);
    });

    it('should write reasoning content to a Node.js response-like object', async () => {
      const mockResponse = createMockServerResponse();

      const result = streamText({
        model: modelWithReasoning,
        ...defaultSettings(),
      });

      result.pipeUIMessageStreamToResponse(mockResponse, {
        sendReasoning: true,
      });

      await mockResponse.waitForEnd();

      expect(mockResponse.statusCode).toBe(200);
      expect(mockResponse.headers).toMatchInlineSnapshot(`
        {
          "cache-control": "no-cache",
          "connection": "keep-alive",
          "content-type": "text/event-stream",
          "x-accel-buffering": "no",
          "x-vercel-ai-ui-message-stream": "v1",
        }
      `);
      expect(mockResponse.getDecodedChunks()).toMatchInlineSnapshot(`
        [
          "data: {"type":"start"}

        ",
          "data: {"type":"start-step"}

        ",
          "data: {"type":"reasoning-start","id":"1"}

        ",
          "data: {"type":"reasoning-delta","id":"1","delta":"I will open the conversation"}

        ",
          "data: {"type":"reasoning-delta","id":"1","delta":" with witty banter."}

        ",
          "data: {"type":"reasoning-delta","id":"1","delta":"","providerMetadata":{"testProvider":{"signature":"1234567890"}}}

        ",
          "data: {"type":"reasoning-end","id":"1"}

        ",
          "data: {"type":"reasoning-start","id":"2","providerMetadata":{"testProvider":{"redactedData":"redacted-reasoning-data"}}}

        ",
          "data: {"type":"reasoning-end","id":"2"}

        ",
          "data: {"type":"reasoning-start","id":"3"}

        ",
          "data: {"type":"reasoning-delta","id":"3","delta":" Once the user has relaxed,"}

        ",
          "data: {"type":"reasoning-delta","id":"3","delta":" I will pry for valuable information."}

        ",
          "data: {"type":"reasoning-end","id":"3","providerMetadata":{"testProvider":{"signature":"1234567890"}}}

        ",
          "data: {"type":"reasoning-start","id":"4","providerMetadata":{"testProvider":{"signature":"1234567890"}}}

        ",
          "data: {"type":"reasoning-delta","id":"4","delta":" I need to think about"}

        ",
          "data: {"type":"reasoning-delta","id":"4","delta":" this problem carefully."}

        ",
          "data: {"type":"reasoning-start","id":"5","providerMetadata":{"testProvider":{"signature":"1234567890"}}}

        ",
          "data: {"type":"reasoning-delta","id":"5","delta":" The best solution"}

        ",
          "data: {"type":"reasoning-delta","id":"5","delta":" requires careful"}

        ",
          "data: {"type":"reasoning-delta","id":"5","delta":" consideration of all factors."}

        ",
          "data: {"type":"reasoning-end","id":"4","providerMetadata":{"testProvider":{"signature":"0987654321"}}}

        ",
          "data: {"type":"reasoning-end","id":"5","providerMetadata":{"testProvider":{"signature":"0987654321"}}}

        ",
          "data: {"type":"text-start","id":"1"}

        ",
          "data: {"type":"text-delta","id":"1","delta":"Hi"}

        ",
          "data: {"type":"text-delta","id":"1","delta":" there!"}

        ",
          "data: {"type":"text-end","id":"1","providerMetadata":{"testProvider":{"signature":"0987654321"}}}

        ",
          "data: {"type":"finish-step"}

        ",
          "data: {"type":"finish","finishReason":"stop"}

        ",
          "data: [DONE]

        ",
        ]
      `);
    });

    it('should write source content to a Node.js response-like object', async () => {
      const mockResponse = createMockServerResponse();

      const result = streamText({
        model: modelWithSources,
        ...defaultSettings(),
      });

      result.pipeUIMessageStreamToResponse(mockResponse, {
        sendSources: true,
      });

      await mockResponse.waitForEnd();

      expect(mockResponse.statusCode).toBe(200);
      expect(mockResponse.headers).toMatchInlineSnapshot(`
        {
          "cache-control": "no-cache",
          "connection": "keep-alive",
          "content-type": "text/event-stream",
          "x-accel-buffering": "no",
          "x-vercel-ai-ui-message-stream": "v1",
        }
      `);
      expect(mockResponse.getDecodedChunks()).toMatchInlineSnapshot(`
        [
          "data: {"type":"start"}

        ",
          "data: {"type":"start-step"}

        ",
          "data: {"type":"source-url","sourceId":"123","url":"https://example.com","title":"Example","providerMetadata":{"provider":{"custom":"value"}}}

        ",
          "data: {"type":"text-start","id":"1"}

        ",
          "data: {"type":"text-delta","id":"1","delta":"Hello!"}

        ",
          "data: {"type":"text-end","id":"1"}

        ",
          "data: {"type":"source-url","sourceId":"456","url":"https://example.com/2","title":"Example 2","providerMetadata":{"provider":{"custom":"value2"}}}

        ",
          "data: {"type":"finish-step"}

        ",
          "data: {"type":"finish","finishReason":"stop"}

        ",
          "data: [DONE]

        ",
        ]
      `);
    });

    it('should write file content to a Node.js response-like object', async () => {
      const mockResponse = createMockServerResponse();

      const result = streamText({
        model: modelWithFiles,
        ...defaultSettings(),
      });

      result.pipeUIMessageStreamToResponse(mockResponse);

      await mockResponse.waitForEnd();

      expect(mockResponse.statusCode).toBe(200);
      expect(mockResponse.headers).toMatchInlineSnapshot(`
        {
          "cache-control": "no-cache",
          "connection": "keep-alive",
          "content-type": "text/event-stream",
          "x-accel-buffering": "no",
          "x-vercel-ai-ui-message-stream": "v1",
        }
      `);
      expect(mockResponse.getDecodedChunks()).toMatchInlineSnapshot(`
        [
          "data: {"type":"start"}

        ",
          "data: {"type":"start-step"}

        ",
          "data: {"type":"file","mediaType":"text/plain","url":"data:text/plain;base64,Hello World"}

        ",
          "data: {"type":"text-start","id":"1"}

        ",
          "data: {"type":"text-delta","id":"1","delta":"Hello!"}

        ",
          "data: {"type":"text-end","id":"1"}

        ",
          "data: {"type":"file","mediaType":"image/jpeg","url":"data:image/jpeg;base64,QkFVRw=="}

        ",
          "data: {"type":"finish-step"}

        ",
          "data: {"type":"finish","finishReason":"stop"}

        ",
          "data: [DONE]

        ",
        ]
      `);
    });
  });

  describe('result.pipeTextStreamToResponse', async () => {
    it('should write text deltas to a Node.js response-like object', async () => {
      const mockResponse = createMockServerResponse();

      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-delta', id: '1', delta: ', ' },
            { type: 'text-delta', id: '1', delta: 'world!' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        prompt: 'test-input',
      });

      result.pipeTextStreamToResponse(mockResponse);

      await mockResponse.waitForEnd();

      expect(mockResponse.statusCode).toBe(200);
      expect(mockResponse.headers).toMatchInlineSnapshot(`
        {
          "content-type": "text/plain; charset=utf-8",
        }
      `);
      expect(mockResponse.getDecodedChunks()).toEqual([
        'Hello',
        ', ',
        'world!',
      ]);
    });
  });

  describe('result.toUIMessageStream', () => {
    it('should include tool metadata in ui message stream chunks', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'test-tool',
              input: `{ "value": "value" }`,
            },
            {
              type: 'finish',
              finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
              usage: testUsage,
            },
          ]),
        }),
        tools: {
          'test-tool': dynamicTool({
            metadata: { clientName: 'MyMCPClient' },
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'result',
          }),
        },
        prompt: 'test-input',
      });

      const chunks = await convertReadableStreamToArray(
        result.toUIMessageStream(),
      );

      expect(chunks.find(chunk => chunk.type === 'tool-input-available'))
        .toMatchInlineSnapshot(`
        {
          "dynamic": true,
          "input": {
            "value": "value",
          },
          "toolCallId": "call-1",
          "toolMetadata": {
            "clientName": "MyMCPClient",
          },
          "toolName": "test-tool",
          "type": "tool-input-available",
        }
      `);
    });

    it('should create a ui message stream', async () => {
      const result = streamText({
        model: createTestModel(),
        ...defaultSettings(),
      });

      const uiMessageStream = result.toUIMessageStream();

      expect(await convertReadableStreamToArray(uiMessageStream))
        .toMatchInlineSnapshot(`
          [
            {
              "type": "start",
            },
            {
              "type": "start-step",
            },
            {
              "id": "1",
              "type": "text-start",
            },
            {
              "delta": "Hello",
              "id": "1",
              "type": "text-delta",
            },
            {
              "delta": ", ",
              "id": "1",
              "type": "text-delta",
            },
            {
              "delta": "world!",
              "id": "1",
              "type": "text-delta",
            },
            {
              "id": "1",
              "type": "text-end",
            },
            {
              "type": "finish-step",
            },
            {
              "finishReason": "stop",
              "type": "finish",
            },
          ]
        `);
    });

    it('should create a ui message stream with provider metadata', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'stream-start',
              warnings: [],
            },
            {
              type: 'reasoning-start',
              id: 'r1',
              providerMetadata: { testProvider: { signature: 'r1' } },
            },
            {
              type: 'reasoning-delta',
              id: 'r1',
              delta: 'Hello',
              providerMetadata: { testProvider: { signature: 'r2' } },
            },
            {
              type: 'reasoning-delta',
              id: 'r1',
              delta: ', ',
              providerMetadata: { testProvider: { signature: 'r3' } },
            },
            {
              type: 'reasoning-end',
              id: 'r1',
              providerMetadata: { testProvider: { signature: 'r4' } },
            },
            {
              type: 'text-start',
              id: '1',
              providerMetadata: { testProvider: { signature: '1' } },
            },
            {
              type: 'text-delta',
              id: '1',
              delta: 'Hello',
              providerMetadata: { testProvider: { signature: '2' } },
            },
            {
              type: 'text-delta',
              id: '1',
              delta: ', ',
              providerMetadata: { testProvider: { signature: '3' } },
            },
            {
              type: 'text-delta',
              id: '1',
              delta: 'world!',
              providerMetadata: { testProvider: { signature: '4' } },
            },
            {
              type: 'text-end',
              id: '1',
              providerMetadata: { testProvider: { signature: '5' } },
            },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        ...defaultSettings(),
      });

      const uiMessageStream = result.toUIMessageStream();

      expect(await convertReadableStreamToArray(uiMessageStream))
        .toMatchInlineSnapshot(`
          [
            {
              "type": "start",
            },
            {
              "type": "start-step",
            },
            {
              "id": "r1",
              "providerMetadata": {
                "testProvider": {
                  "signature": "r1",
                },
              },
              "type": "reasoning-start",
            },
            {
              "delta": "Hello",
              "id": "r1",
              "providerMetadata": {
                "testProvider": {
                  "signature": "r2",
                },
              },
              "type": "reasoning-delta",
            },
            {
              "delta": ", ",
              "id": "r1",
              "providerMetadata": {
                "testProvider": {
                  "signature": "r3",
                },
              },
              "type": "reasoning-delta",
            },
            {
              "id": "r1",
              "providerMetadata": {
                "testProvider": {
                  "signature": "r4",
                },
              },
              "type": "reasoning-end",
            },
            {
              "id": "1",
              "providerMetadata": {
                "testProvider": {
                  "signature": "1",
                },
              },
              "type": "text-start",
            },
            {
              "delta": "Hello",
              "id": "1",
              "providerMetadata": {
                "testProvider": {
                  "signature": "2",
                },
              },
              "type": "text-delta",
            },
            {
              "delta": ", ",
              "id": "1",
              "providerMetadata": {
                "testProvider": {
                  "signature": "3",
                },
              },
              "type": "text-delta",
            },
            {
              "delta": "world!",
              "id": "1",
              "providerMetadata": {
                "testProvider": {
                  "signature": "4",
                },
              },
              "type": "text-delta",
            },
            {
              "id": "1",
              "providerMetadata": {
                "testProvider": {
                  "signature": "5",
                },
              },
              "type": "text-end",
            },
            {
              "type": "finish-step",
            },
            {
              "finishReason": "stop",
              "type": "finish",
            },
          ]
        `);
    });

    it('should send tool call, tool call stream start, tool call deltas, and tool result stream parts', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'tool-input-start', id: 'call-1', toolName: 'tool1' },
            { type: 'tool-input-delta', id: 'call-1', delta: '{ "value":' },
            { type: 'tool-input-delta', id: 'call-1', delta: ' "value" }' },
            { type: 'tool-input-end', id: 'call-1' },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: `{ "value": "value" }`,
            },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          },
        },
        ...defaultSettings(),
      });

      expect(
        await convertReadableStreamToArray(result.toUIMessageStream()),
      ).toMatchSnapshot();
    });

    it('should send message metadata as defined in the metadata function', async () => {
      const result = streamText({
        model: createTestModel(),
        ...defaultSettings(),
      });

      const uiMessageStream = result.toUIMessageStream({
        messageMetadata: mockValues(
          { key1: 'value1' },
          { key2: 'value2' },
          { key3: 'value3' },
          { key4: 'value4' },
          { key5: 'value5' },
          { key6: 'value6' },
          { key7: 'value7' },
          { key8: 'value8' },
        ),
      });

      expect(await convertReadableStreamToArray(uiMessageStream))
        .toMatchInlineSnapshot(`
          [
            {
              "messageMetadata": {
                "key1": "value1",
              },
              "type": "start",
            },
            {
              "type": "start-step",
            },
            {
              "messageMetadata": {
                "key2": "value2",
              },
              "type": "message-metadata",
            },
            {
              "id": "1",
              "type": "text-start",
            },
            {
              "messageMetadata": {
                "key3": "value3",
              },
              "type": "message-metadata",
            },
            {
              "delta": "Hello",
              "id": "1",
              "type": "text-delta",
            },
            {
              "messageMetadata": {
                "key4": "value4",
              },
              "type": "message-metadata",
            },
            {
              "delta": ", ",
              "id": "1",
              "type": "text-delta",
            },
            {
              "messageMetadata": {
                "key5": "value5",
              },
              "type": "message-metadata",
            },
            {
              "delta": "world!",
              "id": "1",
              "type": "text-delta",
            },
            {
              "messageMetadata": {
                "key6": "value6",
              },
              "type": "message-metadata",
            },
            {
              "id": "1",
              "type": "text-end",
            },
            {
              "messageMetadata": {
                "key7": "value7",
              },
              "type": "message-metadata",
            },
            {
              "type": "finish-step",
            },
            {
              "messageMetadata": {
                "key8": "value8",
              },
              "type": "message-metadata",
            },
            {
              "finishReason": "stop",
              "messageMetadata": {
                "key8": "value8",
              },
              "type": "finish",
            },
          ]
        `);
    });

    it('should mask error messages by default', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'error', error: 'error' },
          ]),
        }),
        ...defaultSettings(),
        onError: () => {},
      });

      const uiMessageStream = result.toUIMessageStream();

      expect(
        await convertReadableStreamToArray(uiMessageStream),
      ).toMatchSnapshot();
    });

    it('should support custom error messages', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'error', error: 'error' },
          ]),
        }),
        ...defaultSettings(),
        onError: () => {},
      });

      const uiMessageStream = result.toUIMessageStream({
        onError: error => `custom error message: ${error}`,
      });

      expect(
        await convertReadableStreamToArray(uiMessageStream),
      ).toMatchSnapshot();
    });

    it('should omit message finish event when sendFinish is false', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello, World!' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        ...defaultSettings(),
      });

      const uiMessageStream = result.toUIMessageStream({ sendFinish: false });

      expect(await convertReadableStreamToArray(uiMessageStream))
        .toMatchInlineSnapshot(`
          [
            {
              "type": "start",
            },
            {
              "type": "start-step",
            },
            {
              "id": "1",
              "type": "text-start",
            },
            {
              "delta": "Hello, World!",
              "id": "1",
              "type": "text-delta",
            },
            {
              "id": "1",
              "type": "text-end",
            },
            {
              "type": "finish-step",
            },
          ]
        `);
    });

    it('should omit message start event when sendStart is false', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello, World!' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        ...defaultSettings(),
      });

      const uiMessageStream = result.toUIMessageStream({ sendStart: false });

      expect(await convertReadableStreamToArray(uiMessageStream))
        .toMatchInlineSnapshot(`
          [
            {
              "type": "start-step",
            },
            {
              "id": "1",
              "type": "text-start",
            },
            {
              "delta": "Hello, World!",
              "id": "1",
              "type": "text-delta",
            },
            {
              "id": "1",
              "type": "text-end",
            },
            {
              "type": "finish-step",
            },
            {
              "finishReason": "stop",
              "type": "finish",
            },
          ]
        `);
    });

    it('should omit reasoning content when sendReasoning is false', async () => {
      const result = streamText({
        model: modelWithReasoning,
        ...defaultSettings(),
      });

      const uiMessageStream = result.toUIMessageStream({
        sendReasoning: false,
      });

      expect(await convertReadableStreamToArray(uiMessageStream))
        .toMatchInlineSnapshot(`
          [
            {
              "type": "start",
            },
            {
              "type": "start-step",
            },
            {
              "id": "1",
              "type": "text-start",
            },
            {
              "delta": "Hi",
              "id": "1",
              "type": "text-delta",
            },
            {
              "delta": " there!",
              "id": "1",
              "type": "text-delta",
            },
            {
              "id": "1",
              "providerMetadata": {
                "testProvider": {
                  "signature": "0987654321",
                },
              },
              "type": "text-end",
            },
            {
              "type": "finish-step",
            },
            {
              "finishReason": "stop",
              "type": "finish",
            },
          ]
        `);
    });

    it('should send reasoning content when sendReasoning is true', async () => {
      const result = streamText({
        model: modelWithReasoning,
        ...defaultSettings(),
      });

      const uiMessageStream = result.toUIMessageStream({ sendReasoning: true });

      expect(await convertReadableStreamToArray(uiMessageStream))
        .toMatchInlineSnapshot(`
          [
            {
              "type": "start",
            },
            {
              "type": "start-step",
            },
            {
              "id": "1",
              "type": "reasoning-start",
            },
            {
              "delta": "I will open the conversation",
              "id": "1",
              "type": "reasoning-delta",
            },
            {
              "delta": " with witty banter.",
              "id": "1",
              "type": "reasoning-delta",
            },
            {
              "delta": "",
              "id": "1",
              "providerMetadata": {
                "testProvider": {
                  "signature": "1234567890",
                },
              },
              "type": "reasoning-delta",
            },
            {
              "id": "1",
              "type": "reasoning-end",
            },
            {
              "id": "2",
              "providerMetadata": {
                "testProvider": {
                  "redactedData": "redacted-reasoning-data",
                },
              },
              "type": "reasoning-start",
            },
            {
              "id": "2",
              "type": "reasoning-end",
            },
            {
              "id": "3",
              "type": "reasoning-start",
            },
            {
              "delta": " Once the user has relaxed,",
              "id": "3",
              "type": "reasoning-delta",
            },
            {
              "delta": " I will pry for valuable information.",
              "id": "3",
              "type": "reasoning-delta",
            },
            {
              "id": "3",
              "providerMetadata": {
                "testProvider": {
                  "signature": "1234567890",
                },
              },
              "type": "reasoning-end",
            },
            {
              "id": "4",
              "providerMetadata": {
                "testProvider": {
                  "signature": "1234567890",
                },
              },
              "type": "reasoning-start",
            },
            {
              "delta": " I need to think about",
              "id": "4",
              "type": "reasoning-delta",
            },
            {
              "delta": " this problem carefully.",
              "id": "4",
              "type": "reasoning-delta",
            },
            {
              "id": "5",
              "providerMetadata": {
                "testProvider": {
                  "signature": "1234567890",
                },
              },
              "type": "reasoning-start",
            },
            {
              "delta": " The best solution",
              "id": "5",
              "type": "reasoning-delta",
            },
            {
              "delta": " requires careful",
              "id": "5",
              "type": "reasoning-delta",
            },
            {
              "delta": " consideration of all factors.",
              "id": "5",
              "type": "reasoning-delta",
            },
            {
              "id": "4",
              "providerMetadata": {
                "testProvider": {
                  "signature": "0987654321",
                },
              },
              "type": "reasoning-end",
            },
            {
              "id": "5",
              "providerMetadata": {
                "testProvider": {
                  "signature": "0987654321",
                },
              },
              "type": "reasoning-end",
            },
            {
              "id": "1",
              "type": "text-start",
            },
            {
              "delta": "Hi",
              "id": "1",
              "type": "text-delta",
            },
            {
              "delta": " there!",
              "id": "1",
              "type": "text-delta",
            },
            {
              "id": "1",
              "providerMetadata": {
                "testProvider": {
                  "signature": "0987654321",
                },
              },
              "type": "text-end",
            },
            {
              "type": "finish-step",
            },
            {
              "finishReason": "stop",
              "type": "finish",
            },
          ]
        `);
    });

    it('should send source content when sendSources is true', async () => {
      const result = streamText({
        model: modelWithSources,
        ...defaultSettings(),
      });

      const uiMessageStream = result.toUIMessageStream({ sendSources: true });

      expect(await convertReadableStreamToArray(uiMessageStream))
        .toMatchInlineSnapshot(`
          [
            {
              "type": "start",
            },
            {
              "type": "start-step",
            },
            {
              "providerMetadata": {
                "provider": {
                  "custom": "value",
                },
              },
              "sourceId": "123",
              "title": "Example",
              "type": "source-url",
              "url": "https://example.com",
            },
            {
              "id": "1",
              "type": "text-start",
            },
            {
              "delta": "Hello!",
              "id": "1",
              "type": "text-delta",
            },
            {
              "id": "1",
              "type": "text-end",
            },
            {
              "providerMetadata": {
                "provider": {
                  "custom": "value2",
                },
              },
              "sourceId": "456",
              "title": "Example 2",
              "type": "source-url",
              "url": "https://example.com/2",
            },
            {
              "type": "finish-step",
            },
            {
              "finishReason": "stop",
              "type": "finish",
            },
          ]
        `);
    });

    it('should send document source content when sendSources is true', async () => {
      const result = streamText({
        model: modelWithDocumentSources,
        ...defaultSettings(),
      });

      const uiMessageStream = result.toUIMessageStream({ sendSources: true });

      expect(await convertReadableStreamToArray(uiMessageStream))
        .toMatchInlineSnapshot(`
          [
            {
              "type": "start",
            },
            {
              "type": "start-step",
            },
            {
              "filename": "example.pdf",
              "mediaType": "application/pdf",
              "providerMetadata": {
                "provider": {
                  "custom": "doc-value",
                },
              },
              "sourceId": "doc-123",
              "title": "Document Example",
              "type": "source-document",
            },
            {
              "id": "1",
              "type": "text-start",
            },
            {
              "delta": "Hello from document!",
              "id": "1",
              "type": "text-delta",
            },
            {
              "id": "1",
              "type": "text-end",
            },
            {
              "filename": undefined,
              "mediaType": "text/plain",
              "providerMetadata": {
                "provider": {
                  "custom": "doc-value2",
                },
              },
              "sourceId": "doc-456",
              "title": "Text Document",
              "type": "source-document",
            },
            {
              "type": "finish-step",
            },
            {
              "finishReason": "stop",
              "type": "finish",
            },
          ]
        `);
    });

    it('should send custom parts in toUIMessageStream', async () => {
      const result = streamText({
        model: modelWithCustom,
        ...defaultSettings(),
      });

      const uiMessageStream = result.toUIMessageStream();

      expect(await convertReadableStreamToArray(uiMessageStream))
        .toMatchInlineSnapshot(`
          [
            {
              "type": "start",
            },
            {
              "type": "start-step",
            },
            {
              "id": "1",
              "type": "text-start",
            },
            {
              "delta": "Hello!",
              "id": "1",
              "type": "text-delta",
            },
            {
              "id": "1",
              "type": "text-end",
            },
            {
              "kind": "openai.compaction",
              "providerMetadata": {
                "openai": {
                  "itemId": "cmp_123",
                },
              },
              "type": "custom",
            },
            {
              "type": "finish-step",
            },
            {
              "finishReason": "stop",
              "type": "finish",
            },
          ]
        `);
    });

    it('should send file content', async () => {
      const result = streamText({
        model: modelWithFiles,
        ...defaultSettings(),
      });

      const uiMessageStream = result.toUIMessageStream();

      expect(await convertReadableStreamToArray(uiMessageStream))
        .toMatchInlineSnapshot(`
          [
            {
              "type": "start",
            },
            {
              "type": "start-step",
            },
            {
              "mediaType": "text/plain",
              "type": "file",
              "url": "data:text/plain;base64,Hello World",
            },
            {
              "id": "1",
              "type": "text-start",
            },
            {
              "delta": "Hello!",
              "id": "1",
              "type": "text-delta",
            },
            {
              "id": "1",
              "type": "text-end",
            },
            {
              "mediaType": "image/jpeg",
              "type": "file",
              "url": "data:image/jpeg;base64,QkFVRw==",
            },
            {
              "type": "finish-step",
            },
            {
              "finishReason": "stop",
              "type": "finish",
            },
          ]
        `);
    });

    it('should send file content with providerMetadata', async () => {
      const result = streamText({
        model: modelWithFilesAndProviderMetadata,
        ...defaultSettings(),
      });

      const uiMessageStream = result.toUIMessageStream();
      const parts = await convertReadableStreamToArray(uiMessageStream);
      const fileParts = parts.filter(
        (p: Record<string, unknown>) => p.type === 'file',
      );

      expect(fileParts).toMatchInlineSnapshot(`
        [
          {
            "mediaType": "text/plain",
            "providerMetadata": {
              "testProvider": {
                "signature": "sig-1",
              },
            },
            "type": "file",
            "url": "data:text/plain;base64,Hello World",
          },
          {
            "mediaType": "image/jpeg",
            "type": "file",
            "url": "data:image/jpeg;base64,QkFVRw==",
          },
        ]
      `);
    });

    it('should not generate a new message id when onFinish is provided and generateMessageId is not provided', async () => {
      const result = streamText({
        model: createTestModel(),
        ...defaultSettings(),
      });

      const uiMessageStream = result.toUIMessageStream({
        onFinish: () => {}, // provided onFinish should trigger a new message id
      });

      expect(await convertReadableStreamToArray(uiMessageStream))
        .toMatchInlineSnapshot(`
          [
            {
              "type": "start",
            },
            {
              "type": "start-step",
            },
            {
              "id": "1",
              "type": "text-start",
            },
            {
              "delta": "Hello",
              "id": "1",
              "type": "text-delta",
            },
            {
              "delta": ", ",
              "id": "1",
              "type": "text-delta",
            },
            {
              "delta": "world!",
              "id": "1",
              "type": "text-delta",
            },
            {
              "id": "1",
              "type": "text-end",
            },
            {
              "type": "finish-step",
            },
            {
              "finishReason": "stop",
              "type": "finish",
            },
          ]
        `);
    });

    it('should generate a new message id when generateMessageId is provided', async () => {
      const result = streamText({
        model: createTestModel(),
        ...defaultSettings(),
      });

      const uiMessageStream = result.toUIMessageStream({
        generateMessageId: mockId({ prefix: 'message' }),
      });

      expect(await convertReadableStreamToArray(uiMessageStream))
        .toMatchInlineSnapshot(`
          [
            {
              "messageId": "message-0",
              "type": "start",
            },
            {
              "type": "start-step",
            },
            {
              "id": "1",
              "type": "text-start",
            },
            {
              "delta": "Hello",
              "id": "1",
              "type": "text-delta",
            },
            {
              "delta": ", ",
              "id": "1",
              "type": "text-delta",
            },
            {
              "delta": "world!",
              "id": "1",
              "type": "text-delta",
            },
            {
              "id": "1",
              "type": "text-end",
            },
            {
              "type": "finish-step",
            },
            {
              "finishReason": "stop",
              "type": "finish",
            },
          ]
        `);
    });

    it('should call onFinish when reader.cancel() is called', async () => {
      await expectUndefinedUnhandledRejections({
        count: 3,
        fn: async () => {
          const onFinishCallback = vi.fn();

          const model = new MockLanguageModelV4({
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                {
                  type: 'response-metadata',
                  id: 'msg-2',
                  modelId: 'test-model',
                  timestamp: new Date(),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Streaming' },
                { type: 'text-delta', id: '1', delta: ' content' },
                { type: 'text-delta', id: '1', delta: ' that' },
                { type: 'text-delta', id: '1', delta: ' will' },
                { type: 'text-delta', id: '1', delta: ' be' },
                { type: 'text-delta', id: '1', delta: ' cancelled' },
              ]),
            }),
          });

          const result = streamText({
            model,
            prompt: 'Generate content',
          });

          const uiStream = result.toUIMessageStream({
            onFinish: onFinishCallback,
          });

          const reader = uiStream.getReader();
          const chunks = [];
          for (let i = 0; i < 4; i++) {
            const { value, done } = await reader.read();
            if (done) break;
            chunks.push(value);
          }

          await reader.cancel();
          reader.releaseLock();

          expect(onFinishCallback).toHaveBeenCalledTimes(1);
          const callArgs = onFinishCallback.mock.calls[0][0];
          expect(callArgs.responseMessage).toBeDefined();
          expect(callArgs.responseMessage.role).toBe('assistant');
          const textPart = callArgs.responseMessage.parts.find(
            (p: any) => p.type === 'text',
          );
          expect(textPart).toBeDefined();
          expect(textPart.text).toContain('Streaming'); // Partial content
          expect(textPart.state).toBe('streaming');
          expect(callArgs.isAborted).toBe(false); // Stream was cancelled, not aborted
        },
      });
    });

    it('should call onFinish when async iteration stops mid-stream', async () => {
      await expectUndefinedUnhandledRejections({
        count: 2,
        fn: async () => {
          const onFinishCallback = vi.fn();

          const model = new MockLanguageModelV4({
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                {
                  type: 'response-metadata',
                  id: 'msg-4',
                  modelId: 'test-model',
                  timestamp: new Date(),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'First' },
                { type: 'text-delta', id: '1', delta: ' chunk' },
                { type: 'text-delta', id: '1', delta: ' of' },
                { type: 'text-delta', id: '1', delta: ' text' },
                { type: 'text-delta', id: '1', delta: ' that' },
                { type: 'text-delta', id: '1', delta: ' will' },
                { type: 'text-delta', id: '1', delta: ' be' },
                { type: 'text-delta', id: '1', delta: ' interrupted' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: {
                    inputTokens: {
                      total: 10,
                      noCache: 10,
                      cacheRead: 0,
                      cacheWrite: 0,
                    },
                    outputTokens: { total: 5, text: 5, reasoning: 0 },
                  },
                },
              ]),
            }),
          });

          const result = streamText({
            model,
            prompt: 'Generate text',
          });

          const uiStream = result.toUIMessageStream({
            onFinish: onFinishCallback,
            generateMessageId: () => 'msg-async-iter',
          });

          let chunkCount = 0;
          const collectedChunks: any[] = [];

          for await (const chunk of uiStream) {
            collectedChunks.push(chunk);
            chunkCount++;

            if (chunkCount >= 5) {
              break;
            }
          }

          expect(chunkCount).toBe(5);
          expect(collectedChunks).toHaveLength(5);

          expect(onFinishCallback).toHaveBeenCalledTimes(1);
          const callArgs = onFinishCallback.mock.calls[0][0];
          expect(callArgs.responseMessage.id).toBe('msg-async-iter');
          expect(callArgs.responseMessage.role).toBe('assistant');

          const textPart = callArgs.responseMessage.parts.find(
            (p: any) => p.type === 'text',
          );
          expect(textPart).toBeDefined();
          expect(textPart.text).toContain('First chunk'); // Should have at least the first parts
          expect(textPart.state).toBe('streaming');
          expect(callArgs.isAborted).toBe(false); // No explicit abort, just stopped iteration
        },
      });
    });

    it.skipIf(isNodeVersionAtLeast(24, 15))(
      'should call onFinish when stream is aborted via AbortController',
      async () => {
        const onFinishCallback = vi.fn();
        const abortController = new AbortController();

        const model = new MockLanguageModelV4({
          doStream: async ({ abortSignal }) => {
            const stream = new ReadableStream({
              async start(controller) {
                const onAbort = () => {
                  controller.error(new DOMException('Aborted', 'AbortError'));
                };
                abortSignal?.addEventListener('abort', onAbort, { once: true });

                controller.enqueue({
                  type: 'response-metadata',
                  id: 'msg-1',
                  modelId: 'test-model',
                  timestamp: new Date(),
                });
                controller.enqueue({ type: 'text-start', id: '1' });
                controller.enqueue({
                  type: 'text-delta',
                  id: '1',
                  delta: 'Hello',
                });
                controller.enqueue({
                  type: 'text-delta',
                  id: '1',
                  delta: ' world',
                });

                await new Promise(resolve => setTimeout(resolve, 10));

                if (!abortSignal?.aborted) {
                  controller.enqueue({
                    type: 'text-delta',
                    id: '1',
                    delta: ' from AI',
                  });
                  controller.enqueue({ type: 'text-end', id: '1' });
                  controller.enqueue({
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: {
                      inputTokens: 10,
                      outputTokens: 5,
                      totalTokens: 15,
                    },
                  });
                  controller.close();
                }
              },
            });

            return { stream };
          },
        });

        const result = streamText({
          model,
          prompt: 'Say hello',
          abortSignal: abortController.signal,
        });

        const uiStream = result.toUIMessageStream({
          onFinish: onFinishCallback,
        });

        const reader = uiStream.getReader();
        const chunks = [];

        for (let i = 0; i < 3; i++) {
          const { value, done } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        abortController.abort();
        const { value: abortChunk } = await reader.read();
        expect(abortChunk?.type).toBe('abort');

        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }

        expect(onFinishCallback).toHaveBeenCalledTimes(1);
        const callArgs = onFinishCallback.mock.calls[0][0];
        expect(callArgs.responseMessage).toBeDefined();
        expect(callArgs.responseMessage.role).toBe('assistant');
        const textPart = callArgs.responseMessage.parts.find(
          (p: any) => p.type === 'text',
        );
        expect(textPart).toBeDefined();
        expect(textPart.text).toBe(''); // Text was not streamed yet when aborted
        expect(callArgs.isAborted).toBe(true); // Stream was aborted

        reader.releaseLock();
      },
    );

    it('should NOT call onFinish when for-await loop breaks early', async () => {
      await expectUndefinedUnhandledRejections({
        count: 2,
        fn: async () => {
          const onFinish = vi.fn();

          const result = streamText({
            model: createTestModel({
              stream: convertArrayToReadableStream([
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ' World' },
                { type: 'text-delta', id: '1', delta: '!' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            }),
            prompt: 'test-input',
            onFinish,
          });

          // Get the UI message stream and break after third chunk
          const stream = result.toUIMessageStream();
          let chunkCount = 0;

          for await (const chunk of stream) {
            chunkCount++;
            if (chunkCount === 3) {
              break; // Break the iteration early, simulating cancellation
            }
          }

          // Verify that onFinish was NOT called when stream was cancelled
          expect(onFinish).not.toHaveBeenCalled();
        },
      });
    });

    it('should NOT call onFinish when reader.cancel() is called', async () => {
      await expectUndefinedUnhandledRejections({
        fn: async () => {
          const onFinishCallback = vi.fn();

          const result = streamText({
            model: createTestModel({
              stream: convertArrayToReadableStream([
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ' World' },
                { type: 'text-delta', id: '1', delta: '!' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            }),
            prompt: 'test-input',
            onFinish: onFinishCallback,
          });

          const uiStream = result.toUIMessageStream();

          const reader = uiStream.getReader();
          const chunks = [];
          for (let i = 0; i < 4; i++) {
            const { value, done } = await reader.read();
            if (done) break;
            chunks.push(value);
          }

          await reader.cancel();
          reader.releaseLock();

          // Verify that onFinish was NOT called when stream was cancelled
          expect(onFinishCallback).not.toHaveBeenCalled();
        },
      });
    });
  });

  describe('result.toUIMessageStreamResponse', () => {
    it('should create a Response with a data stream', async () => {
      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        _internal: {
          generateId: mockId({ prefix: 'id' }),
          generateCallId: () => 'test-telemetry-call-id',
        },
      });

      const response = result.toUIMessageStreamResponse();

      expect(response.status).toStrictEqual(200);
      expect(Object.fromEntries(response.headers.entries()))
        .toMatchInlineSnapshot(`
          {
            "cache-control": "no-cache",
            "connection": "keep-alive",
            "content-type": "text/event-stream",
            "x-accel-buffering": "no",
            "x-vercel-ai-ui-message-stream": "v1",
          }
        `);

      expect(await convertResponseStreamToArray(response))
        .toMatchInlineSnapshot(`
          [
            "data: {"type":"start"}

          ",
            "data: {"type":"start-step"}

          ",
            "data: {"type":"text-start","id":"1"}

          ",
            "data: {"type":"text-delta","id":"1","delta":"Hello"}

          ",
            "data: {"type":"text-delta","id":"1","delta":", "}

          ",
            "data: {"type":"text-delta","id":"1","delta":"world!"}

          ",
            "data: {"type":"text-end","id":"1"}

          ",
            "data: {"type":"finish-step"}

          ",
            "data: {"type":"finish","finishReason":"stop"}

          ",
            "data: [DONE]

          ",
          ]
        `);
    });

    it('should create a Response with a data stream and custom headers', async () => {
      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        _internal: {
          generateId: mockId({ prefix: 'id' }),
          generateCallId: () => 'test-telemetry-call-id',
        },
      });

      const response = result.toUIMessageStreamResponse({
        status: 201,
        statusText: 'foo',
        headers: {
          'custom-header': 'custom-value',
        },
      });

      expect(response.status).toStrictEqual(201);
      expect(response.statusText).toStrictEqual('foo');
      expect(Object.fromEntries(response.headers.entries()))
        .toMatchInlineSnapshot(`
          {
            "cache-control": "no-cache",
            "connection": "keep-alive",
            "content-type": "text/event-stream",
            "custom-header": "custom-value",
            "x-accel-buffering": "no",
            "x-vercel-ai-ui-message-stream": "v1",
          }
        `);
      expect(await convertResponseStreamToArray(response))
        .toMatchInlineSnapshot(`
          [
            "data: {"type":"start"}

          ",
            "data: {"type":"start-step"}

          ",
            "data: {"type":"text-start","id":"1"}

          ",
            "data: {"type":"text-delta","id":"1","delta":"Hello"}

          ",
            "data: {"type":"text-delta","id":"1","delta":", "}

          ",
            "data: {"type":"text-delta","id":"1","delta":"world!"}

          ",
            "data: {"type":"text-end","id":"1"}

          ",
            "data: {"type":"finish-step"}

          ",
            "data: {"type":"finish","finishReason":"stop"}

          ",
            "data: [DONE]

          ",
          ]
        `);
    });

    it('should mask error messages by default', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'error', error: 'error' },
          ]),
        }),
        prompt: 'test-input',
        _internal: {
          generateId: mockId({ prefix: 'id' }),
          generateCallId: () => 'test-telemetry-call-id',
        },
        onError: () => {},
      });

      const response = result.toUIMessageStreamResponse();

      expect(await convertResponseStreamToArray(response)).toMatchSnapshot();
    });

    it('should support custom error messages', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'error', error: 'error' },
          ]),
        }),
        prompt: 'test-input',
        _internal: {
          generateId: mockId({ prefix: 'id' }),
          generateCallId: () => 'test-telemetry-call-id',
        },
        onError: () => {},
      });

      const response = result.toUIMessageStreamResponse({
        onError: error => `custom error message: ${error}`,
      });

      expect(await convertResponseStreamToArray(response)).toMatchSnapshot();
    });
  });

  describe('result.toTextStreamResponse', () => {
    it('should create a Response with a text stream', async () => {
      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
      });

      const response = result.toTextStreamResponse();

      expect(response.status).toStrictEqual(200);
      expect(Object.fromEntries(response.headers.entries())).toStrictEqual({
        'content-type': 'text/plain; charset=utf-8',
      });
      expect(await convertResponseStreamToArray(response)).toStrictEqual([
        'Hello',
        ', ',
        'world!',
      ]);
    });
  });

  describe('result.consumeStream', () => {
    it('should ignore AbortError during stream consumption', async () => {
      const result = streamText({
        model: createTestModel({
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'text-start', id: '1' });
              controller.enqueue({
                type: 'text-delta',
                id: '1',
                delta: 'Hello',
              });
              queueMicrotask(() => {
                controller.error(
                  Object.assign(new Error('Stream aborted'), {
                    name: 'AbortError',
                  }),
                );
              });
            },
          }),
        }),
        prompt: 'test-input',
      });

      await expect(result.consumeStream()).resolves.not.toThrow();
    });

    it('should ignore ResponseAborted error during stream consumption', async () => {
      const result = streamText({
        model: createTestModel({
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'text-start', id: '1' });
              controller.enqueue({
                type: 'text-delta',
                id: '1',
                delta: 'Hello',
              });
              queueMicrotask(() => {
                controller.error(
                  Object.assign(new Error('Response aborted'), {
                    name: 'ResponseAborted',
                  }),
                );
              });
            },
          }),
        }),
        prompt: 'test-input',
      });

      await expect(result.consumeStream()).resolves.not.toThrow();
    });

    it('should ignore any errors during stream consumption', async () => {
      const result = streamText({
        model: createTestModel({
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'text-start', id: '1' });
              controller.enqueue({
                type: 'text-delta',
                id: '1',
                delta: 'Hello',
              });
              queueMicrotask(() => {
                controller.error(Object.assign(new Error('Some error')));
              });
            },
          }),
        }),
        prompt: 'test-input',
      });

      await expect(result.consumeStream()).resolves.not.toThrow();
    });

    it('should call the onError callback with the error', async () => {
      const onErrorCallback = vi.fn();
      const result = streamText({
        model: createTestModel({
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'text-start', id: '1' });
              controller.enqueue({
                type: 'text-delta',
                id: '1',
                delta: 'Hello',
              });
              queueMicrotask(() => {
                controller.error(Object.assign(new Error('Some error')));
              });
            },
          }),
        }),
        prompt: 'test-input',
      });

      await expect(
        result.consumeStream({ onError: onErrorCallback }),
      ).resolves.not.toThrow();
      expect(onErrorCallback).toHaveBeenCalledWith(new Error('Some error'));
    });
  });

  describe('multiple stream consumption', () => {
    it('should support text stream, ai stream, full stream on single result object', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-delta', id: '1', delta: ', ' },
            { type: 'text-delta', id: '1', delta: 'world!' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        prompt: 'test-input',
        _internal: {
          generateId: mockId({ prefix: 'id' }),
          generateCallId: () => 'test-telemetry-call-id',
        },
      });

      expect({
        textStream: await convertAsyncIterableToArray(result.textStream),
        stream: await convertAsyncIterableToArray(result.stream),
        uiMessageStream: await convertReadableStreamToArray(
          result.toUIMessageStream(),
        ),
      }).toMatchInlineSnapshot(`
        {
          "stream": [
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
              "id": "1",
              "type": "text-start",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": "Hello",
              "type": "text-delta",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": ", ",
              "type": "text-delta",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": "world!",
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
                "id": "id-0",
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "type": "finish-step",
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
              "finishReason": "stop",
              "rawFinishReason": "stop",
              "totalUsage": {
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
                "totalTokens": 13,
              },
              "type": "finish",
            },
          ],
          "textStream": [
            "Hello",
            ", ",
            "world!",
          ],
          "uiMessageStream": [
            {
              "type": "start",
            },
            {
              "type": "start-step",
            },
            {
              "id": "1",
              "type": "text-start",
            },
            {
              "delta": "Hello",
              "id": "1",
              "type": "text-delta",
            },
            {
              "delta": ", ",
              "id": "1",
              "type": "text-delta",
            },
            {
              "delta": "world!",
              "id": "1",
              "type": "text-delta",
            },
            {
              "id": "1",
              "type": "text-end",
            },
            {
              "type": "finish-step",
            },
            {
              "finishReason": "stop",
              "type": "finish",
            },
          ],
        }
      `);
    });
  });

  describe('result.warnings', () => {
    it('should resolve with warnings', async () => {
      const result = streamText({
        model: createTestModel({
          warnings: [{ type: 'other', message: 'test-warning' }],
        }),
        prompt: 'test-input',
      });

      expect(await result.warnings).toStrictEqual([
        { type: 'other', message: 'test-warning' },
      ]);
    });

    it('should resolve with warnings from all steps', async () => {
      let responseCount = 0;
      const warning0 = { type: 'other' as const, message: 'step 0 warning' };
      const warning1 = { type: 'other' as const, message: 'step 1 warning' };

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'stream-start',
                      warnings: [warning0],
                    },
                    {
                      type: 'tool-call',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{}',
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'tool-calls', raw: undefined },
                      usage: testUsage,
                    },
                  ]),
                };
              case 1:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'stream-start',
                      warnings: [warning1],
                    },
                    { type: 'text-start', id: '1' },
                    { type: 'text-delta', id: '1', delta: 'Done.' },
                    { type: 'text-end', id: '1' },
                    {
                      type: 'finish',
                      finishReason: { unified: 'stop', raw: 'stop' },
                      usage: testUsage,
                    },
                  ]),
                };
              default:
                throw new Error(`Unexpected response count: ${responseCount}`);
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({}),
            execute: async () => 'result1',
          }),
        },
        prompt: 'test-input',
        stopWhen: isStepCount(3),
      });

      expect(await result.warnings).toEqual([warning0, warning1]);
      expect((await result.finalStep).warnings).toEqual([warning1]);
    });

    it('should send warnings from all steps to onFinish', async () => {
      let responseCount = 0;
      let onFinishResult!: Parameters<GenerateTextOnEndCallback<any, any>>[0];
      const warning0 = { type: 'other' as const, message: 'step 0 warning' };
      const warning1 = { type: 'other' as const, message: 'step 1 warning' };

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'stream-start',
                      warnings: [warning0],
                    },
                    {
                      type: 'tool-call',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{}',
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'tool-calls', raw: undefined },
                      usage: testUsage,
                    },
                  ]),
                };
              case 1:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'stream-start',
                      warnings: [warning1],
                    },
                    { type: 'text-start', id: '1' },
                    { type: 'text-delta', id: '1', delta: 'Done.' },
                    { type: 'text-end', id: '1' },
                    {
                      type: 'finish',
                      finishReason: { unified: 'stop', raw: 'stop' },
                      usage: testUsage,
                    },
                  ]),
                };
              default:
                throw new Error(`Unexpected response count: ${responseCount}`);
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({}),
            execute: async () => 'result1',
          }),
        },
        prompt: 'test-input',
        stopWhen: isStepCount(3),
        onFinish: async event => {
          onFinishResult = event;
        },
      });

      await result.consumeStream();

      expect(onFinishResult.warnings).toEqual([warning0, warning1]);
      expect(onFinishResult.steps.at(-1)!.warnings).toEqual([warning1]);
    });
  });

  describe('result.usage', () => {
    it('should resolve with token usage', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        prompt: 'test-input',
      });

      expect(await result.usage).toMatchInlineSnapshot(`
        {
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
          "totalTokens": 13,
        }
      `);
    });
  });

  describe('result.finishReason', () => {
    it('should resolve with finish reason', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        prompt: 'test-input',
      });

      expect(await result.finishReason).toStrictEqual('stop');
    });
  });

  describe('result.providerMetadata', () => {
    it('should resolve with provider metadata', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
              providerMetadata: {
                testProvider: { testKey: 'testValue' },
              },
            },
          ]),
        }),
        prompt: 'test-input',
      });

      expect(await result.providerMetadata).toStrictEqual({
        testProvider: { testKey: 'testValue' },
      });
    });
  });

  describe('result.responseMessages', () => {
    it('should contain reasoning', async () => {
      const result = streamText({
        model: modelWithReasoning,
        ...defaultSettings(),
      });

      expect(await result.responseMessages).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "providerOptions": {
                  "testProvider": {
                    "signature": "1234567890",
                  },
                },
                "text": "I will open the conversation with witty banter.",
                "type": "reasoning",
              },
              {
                "providerOptions": {
                  "testProvider": {
                    "redactedData": "redacted-reasoning-data",
                  },
                },
                "text": "",
                "type": "reasoning",
              },
              {
                "providerOptions": {
                  "testProvider": {
                    "signature": "1234567890",
                  },
                },
                "text": " Once the user has relaxed, I will pry for valuable information.",
                "type": "reasoning",
              },
              {
                "providerOptions": {
                  "testProvider": {
                    "signature": "0987654321",
                  },
                },
                "text": " I need to think about this problem carefully.",
                "type": "reasoning",
              },
              {
                "providerOptions": {
                  "testProvider": {
                    "signature": "0987654321",
                  },
                },
                "text": " The best solution requires careful consideration of all factors.",
                "type": "reasoning",
              },
              {
                "providerOptions": {
                  "testProvider": {
                    "signature": "0987654321",
                  },
                },
                "text": "Hi there!",
                "type": "text",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });
  });

  describe('result.request', () => {
    it('should exclude request body and request messages by default', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
          request: { body: 'test body' },
        }),
        prompt: 'test-input',
      });

      expect(await result.request).toStrictEqual({
        body: undefined,
        messages: undefined,
      });
    });

    it('should include request body when retention.requestBody is true', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
          request: { body: 'test body' },
        }),
        prompt: 'test-input',
        include: { requestBody: true },
      });

      expect(await result.request).toStrictEqual({
        body: 'test body',
        messages: undefined,
      });
    });

    it('should accept deprecated experimental_include as an alias for include', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
          request: { body: 'test body' },
        }),
        prompt: 'test-input',
        experimental_include: { requestBody: true },
      });

      expect(await result.request).toStrictEqual({
        body: 'test body',
        messages: undefined,
      });
    });

    it('should prefer include over deprecated experimental_include', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
          request: { body: 'test body' },
        }),
        prompt: 'test-input',
        include: { requestBody: false },
        experimental_include: { requestBody: true },
      });

      expect(await result.request).toStrictEqual({
        body: undefined,
        messages: undefined,
      });
    });

    it('should include request messages when retention.requestMessages is true', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
          request: { body: 'test body' },
        }),
        prompt: 'test-input',
        include: { requestBody: true, requestMessages: true },
      });

      expect(await result.request).toStrictEqual({
        body: 'test body',
        messages: [{ role: 'user', content: 'test-input' }],
      });
      expect((await result.steps)[0].request.messages).toStrictEqual([
        { role: 'user', content: 'test-input' },
      ]);
    });

    it('should resolve with messages from after prepareStep', async () => {
      const preparedMessages: Array<ModelMessage> = [
        { role: 'user', content: 'prepared prompt' },
      ];

      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        prompt: 'test-input',
        prepareStep: async () => ({
          messages: preparedMessages,
        }),
        include: { requestMessages: true },
      });

      expect((await result.request).messages).toStrictEqual(preparedMessages);
      expect((await result.steps)[0].request.messages).toStrictEqual(
        preparedMessages,
      );
    });

    it('should carry messages from prepareStep forward to the next step', async () => {
      const preparedMessages: Array<ModelMessage> = [
        { role: 'user', content: 'prepared prompt' },
      ];
      const prepareStepMessages: Array<Array<ModelMessage>> = [];
      let responseCount = 0;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream<LanguageModelV4StreamPart>(
              responseCount++ === 0
                ? [
                    {
                      type: 'stream-start',
                      warnings: [],
                    },
                    {
                      type: 'tool-call',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{ "value": "test" }',
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'tool-calls', raw: undefined },
                      usage: testUsage,
                    },
                  ]
                : [
                    {
                      type: 'stream-start',
                      warnings: [],
                    },
                    { type: 'text-start', id: '1' },
                    { type: 'text-delta', id: '1', delta: 'Done.' },
                    { type: 'text-end', id: '1' },
                    {
                      type: 'finish',
                      finishReason: { unified: 'stop', raw: 'stop' },
                      usage: testUsage,
                    },
                  ],
            ),
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'prompt',
        stopWhen: isStepCount(3),
        prepareStep: async ({ messages, stepNumber }) => {
          prepareStepMessages.push([...messages]);

          if (stepNumber === 0) {
            return { messages: preparedMessages };
          }
        },
        include: { requestMessages: true },
        onError: () => {},
      });

      await result.consumeStream();

      const steps = await result.steps;
      expect(prepareStepMessages[1]).toEqual([
        ...preparedMessages,
        ...steps[0].response.messages,
      ]);
      expect(steps[1].request.messages).toEqual([
        ...preparedMessages,
        ...steps[0].response.messages,
      ]);
    });
  });

  describe('result.response', () => {
    it('should resolve with response information', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
          response: { headers: { call: '2' } },
        }),
        ...defaultSettings(),
      });

      expect(await result.response).toMatchInlineSnapshot(`
        {
          "headers": {
            "call": "2",
          },
          "id": "id-0",
          "messages": [
            {
              "content": [
                {
                  "providerOptions": undefined,
                  "text": "Hello",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ],
          "modelId": "mock-model-id",
          "timestamp": 1970-01-01T00:00:00.000Z,
        }
      `);
    });
  });

  describe('result.text', () => {
    it('should resolve with full text', async () => {
      const result = streamText({
        model: createTestModel(),
        ...defaultSettings(),
      });

      expect(await result.text).toMatchSnapshot();
    });
  });

  describe('result.reasoningText', () => {
    it('should contain reasoning text from model response', async () => {
      const result = streamText({
        model: modelWithReasoning,
        ...defaultSettings(),
      });

      expect(await result.reasoningText).toMatchSnapshot();
    });
  });

  describe('result.reasoning', () => {
    it('should contain reasoning from model response', async () => {
      const result = streamText({
        model: modelWithReasoning,
        ...defaultSettings(),
      });

      expect(await result.reasoning).toMatchSnapshot();
    });
  });

  describe('result.sources', () => {
    it('should contain sources', async () => {
      const result = streamText({
        model: modelWithSources,
        ...defaultSettings(),
      });

      expect(await result.sources).toMatchSnapshot();
    });

    it('should contain sources from all steps', async () => {
      let responseCount = 0;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'source',
                      sourceType: 'url',
                      id: 'source-0',
                      url: 'https://example.com/0',
                      title: 'Source 0',
                    },
                    {
                      type: 'tool-call',
                      id: 'call-1',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{}',
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'tool-calls', raw: undefined },
                      usage: testUsage,
                    },
                  ]),
                };
              case 1:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'source',
                      sourceType: 'url',
                      id: 'source-1',
                      url: 'https://example.com/1',
                      title: 'Source 1',
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'stop', raw: 'stop' },
                      usage: testUsage,
                    },
                  ]),
                };
              default:
                throw new Error(`Unexpected response count: ${responseCount}`);
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({}),
            execute: async () => 'result1',
          }),
        },
        ...defaultSettings(),
        stopWhen: isStepCount(3),
      });

      expect(await result.sources).toEqual([
        {
          type: 'source',
          sourceType: 'url',
          id: 'source-0',
          url: 'https://example.com/0',
          title: 'Source 0',
        },
        {
          type: 'source',
          sourceType: 'url',
          id: 'source-1',
          url: 'https://example.com/1',
          title: 'Source 1',
        },
      ]);

      expect((await result.finalStep).sources).toEqual([
        {
          type: 'source',
          sourceType: 'url',
          id: 'source-1',
          url: 'https://example.com/1',
          title: 'Source 1',
        },
      ]);
    });
  });

  describe('result.files', () => {
    it('should contain files', async () => {
      const result = streamText({
        model: modelWithFiles,
        ...defaultSettings(),
      });

      expect(await result.files).toMatchSnapshot();
    });

    it('should contain files from all steps', async () => {
      let responseCount = 0;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'file',
                      data: { type: 'data', data: 'c3RlcC0w' },
                      mediaType: 'text/plain',
                    },
                    {
                      type: 'tool-call',
                      id: 'call-1',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{}',
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'tool-calls', raw: undefined },
                      usage: testUsage,
                    },
                  ]),
                };
              case 1:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'file',
                      data: { type: 'data', data: 'c3RlcC0x' },
                      mediaType: 'text/plain',
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'stop', raw: 'stop' },
                      usage: testUsage,
                    },
                  ]),
                };
              default:
                throw new Error(`Unexpected response count: ${responseCount}`);
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({}),
            execute: async () => 'result1',
          }),
        },
        ...defaultSettings(),
        stopWhen: isStepCount(3),
      });

      expect(
        (await result.files).map(file => ({
          base64: file.base64,
          mediaType: file.mediaType,
        })),
      ).toEqual([
        { base64: 'c3RlcC0w', mediaType: 'text/plain' },
        { base64: 'c3RlcC0x', mediaType: 'text/plain' },
      ]);

      expect(
        (await result.finalStep).files.map(file => ({
          base64: file.base64,
          mediaType: file.mediaType,
        })),
      ).toEqual([{ base64: 'c3RlcC0x', mediaType: 'text/plain' }]);
    });

    it('should send files from all steps to onFinish', async () => {
      let responseCount = 0;
      let onFinishResult!: Parameters<GenerateTextOnEndCallback<any, any>>[0];

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'file',
                      data: { type: 'data', data: 'c3RlcC0w' },
                      mediaType: 'text/plain',
                    },
                    {
                      type: 'tool-call',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{}',
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'tool-calls', raw: undefined },
                      usage: testUsage,
                    },
                  ]),
                };
              case 1:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'file',
                      data: { type: 'data', data: 'c3RlcC0x' },
                      mediaType: 'text/plain',
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'stop', raw: 'stop' },
                      usage: testUsage,
                    },
                  ]),
                };
              default:
                throw new Error(`Unexpected response count: ${responseCount}`);
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({}),
            execute: async () => 'result1',
          }),
        },
        ...defaultSettings(),
        stopWhen: isStepCount(3),
        onFinish: async event => {
          onFinishResult = event;
        },
      });

      await result.consumeStream();

      expect(
        onFinishResult.files.map(file => ({
          base64: file.base64,
          mediaType: file.mediaType,
        })),
      ).toEqual([
        { base64: 'c3RlcC0w', mediaType: 'text/plain' },
        { base64: 'c3RlcC0x', mediaType: 'text/plain' },
      ]);

      expect(
        onFinishResult.steps.at(-1)!.files.map(file => ({
          base64: file.base64,
          mediaType: file.mediaType,
        })),
      ).toEqual([{ base64: 'c3RlcC0x', mediaType: 'text/plain' }]);
    });

    it('should contain file content parts from all steps in result.content', async () => {
      let responseCount = 0;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'file',
                      data: { type: 'data', data: 'c3RlcC0w' },
                      mediaType: 'text/plain',
                    },
                    {
                      type: 'tool-call',
                      id: 'call-1',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{}',
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'tool-calls', raw: undefined },
                      usage: testUsage,
                    },
                  ]),
                };
              case 1:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'file',
                      data: { type: 'data', data: 'c3RlcC0x' },
                      mediaType: 'text/plain',
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'stop', raw: 'stop' },
                      usage: testUsage,
                    },
                  ]),
                };
              default:
                throw new Error(`Unexpected response count: ${responseCount}`);
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({}),
            execute: async () => 'result1',
          }),
        },
        ...defaultSettings(),
        stopWhen: isStepCount(3),
      });

      const content = await result.content;
      const fileParts = content.filter(part => part.type === 'file');

      expect(
        fileParts.map(part => ({
          base64: part.file.base64,
          mediaType: part.file.mediaType,
        })),
      ).toEqual([
        { base64: 'c3RlcC0w', mediaType: 'text/plain' },
        { base64: 'c3RlcC0x', mediaType: 'text/plain' },
      ]);

      expect(
        (await result.finalStep).content.filter(part => part.type === 'file'),
      ).toHaveLength(1);
    });
  });

  describe('result.steps', () => {
    it('should add the reasoning from the model response to the step result', async () => {
      const result = streamText({
        model: modelWithReasoning,
        ...defaultSettings(),
      });

      expect(await result.steps).toMatchInlineSnapshot(`
        [
          DefaultStepResult {
            "callId": "test-telemetry-call-id",
            "content": [
              {
                "providerMetadata": {
                  "testProvider": {
                    "signature": "1234567890",
                  },
                },
                "text": "I will open the conversation with witty banter.",
                "type": "reasoning",
              },
              {
                "providerMetadata": {
                  "testProvider": {
                    "redactedData": "redacted-reasoning-data",
                  },
                },
                "text": "",
                "type": "reasoning",
              },
              {
                "providerMetadata": {
                  "testProvider": {
                    "signature": "1234567890",
                  },
                },
                "text": " Once the user has relaxed, I will pry for valuable information.",
                "type": "reasoning",
              },
              {
                "providerMetadata": {
                  "testProvider": {
                    "signature": "0987654321",
                  },
                },
                "text": " I need to think about this problem carefully.",
                "type": "reasoning",
              },
              {
                "providerMetadata": {
                  "testProvider": {
                    "signature": "0987654321",
                  },
                },
                "text": " The best solution requires careful consideration of all factors.",
                "type": "reasoning",
              },
              {
                "providerMetadata": {
                  "testProvider": {
                    "signature": "0987654321",
                  },
                },
                "text": "Hi there!",
                "type": "text",
              },
            ],
            "finishReason": "stop",
            "model": {
              "modelId": "mock-model-id",
              "provider": "mock-provider",
            },
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
            "request": {
              "body": undefined,
              "messages": undefined,
            },
            "response": {
              "headers": undefined,
              "id": "id-0",
              "messages": [
                {
                  "content": [
                    {
                      "providerOptions": {
                        "testProvider": {
                          "signature": "1234567890",
                        },
                      },
                      "text": "I will open the conversation with witty banter.",
                      "type": "reasoning",
                    },
                    {
                      "providerOptions": {
                        "testProvider": {
                          "redactedData": "redacted-reasoning-data",
                        },
                      },
                      "text": "",
                      "type": "reasoning",
                    },
                    {
                      "providerOptions": {
                        "testProvider": {
                          "signature": "1234567890",
                        },
                      },
                      "text": " Once the user has relaxed, I will pry for valuable information.",
                      "type": "reasoning",
                    },
                    {
                      "providerOptions": {
                        "testProvider": {
                          "signature": "0987654321",
                        },
                      },
                      "text": " I need to think about this problem carefully.",
                      "type": "reasoning",
                    },
                    {
                      "providerOptions": {
                        "testProvider": {
                          "signature": "0987654321",
                        },
                      },
                      "text": " The best solution requires careful consideration of all factors.",
                      "type": "reasoning",
                    },
                    {
                      "providerOptions": {
                        "testProvider": {
                          "signature": "0987654321",
                        },
                      },
                      "text": "Hi there!",
                      "type": "text",
                    },
                  ],
                  "role": "assistant",
                },
              ],
              "modelId": "mock-model-id",
              "timestamp": 1970-01-01T00:00:00.000Z,
            },
            "runtimeContext": {},
            "stepNumber": 0,
            "toolsContext": {},
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
            "warnings": [],
          },
        ]
      `);
    });

    it('should add the sources from the model response to the step result', async () => {
      const result = streamText({
        model: modelWithSources,
        ...defaultSettings(),
      });

      expect(await result.steps).toMatchInlineSnapshot(`
        [
          DefaultStepResult {
            "callId": "test-telemetry-call-id",
            "content": [
              {
                "id": "123",
                "providerMetadata": {
                  "provider": {
                    "custom": "value",
                  },
                },
                "sourceType": "url",
                "title": "Example",
                "type": "source",
                "url": "https://example.com",
              },
              {
                "providerMetadata": undefined,
                "text": "Hello!",
                "type": "text",
              },
              {
                "id": "456",
                "providerMetadata": {
                  "provider": {
                    "custom": "value2",
                  },
                },
                "sourceType": "url",
                "title": "Example 2",
                "type": "source",
                "url": "https://example.com/2",
              },
            ],
            "finishReason": "stop",
            "model": {
              "modelId": "mock-model-id",
              "provider": "mock-provider",
            },
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
            "request": {
              "body": undefined,
              "messages": undefined,
            },
            "response": {
              "headers": undefined,
              "id": "id-0",
              "messages": [
                {
                  "content": [
                    {
                      "providerOptions": undefined,
                      "text": "Hello!",
                      "type": "text",
                    },
                  ],
                  "role": "assistant",
                },
              ],
              "modelId": "mock-model-id",
              "timestamp": 1970-01-01T00:00:00.000Z,
            },
            "runtimeContext": {},
            "stepNumber": 0,
            "toolsContext": {},
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
            "warnings": [],
          },
        ]
      `);
    });

    it('should add the files from the model response to the step result', async () => {
      const result = streamText({
        model: modelWithFiles,
        ...defaultSettings(),
      });

      expect(await result.steps).toMatchInlineSnapshot(`
        [
          DefaultStepResult {
            "callId": "test-telemetry-call-id",
            "content": [
              {
                "file": DefaultGeneratedFileWithType {
                  "base64Data": "Hello World",
                  "mediaType": "text/plain",
                  "type": "file",
                  "uint8ArrayData": undefined,
                },
                "type": "file",
              },
              {
                "providerMetadata": undefined,
                "text": "Hello!",
                "type": "text",
              },
              {
                "file": DefaultGeneratedFileWithType {
                  "base64Data": "QkFVRw==",
                  "mediaType": "image/jpeg",
                  "type": "file",
                  "uint8ArrayData": undefined,
                },
                "type": "file",
              },
            ],
            "finishReason": "stop",
            "model": {
              "modelId": "mock-model-id",
              "provider": "mock-provider",
            },
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
            "request": {
              "body": undefined,
              "messages": undefined,
            },
            "response": {
              "headers": undefined,
              "id": "id-0",
              "messages": [
                {
                  "content": [
                    {
                      "data": "Hello World",
                      "mediaType": "text/plain",
                      "providerOptions": undefined,
                      "type": "file",
                    },
                    {
                      "providerOptions": undefined,
                      "text": "Hello!",
                      "type": "text",
                    },
                    {
                      "data": "QkFVRw==",
                      "mediaType": "image/jpeg",
                      "providerOptions": undefined,
                      "type": "file",
                    },
                  ],
                  "role": "assistant",
                },
              ],
              "modelId": "mock-model-id",
              "timestamp": 1970-01-01T00:00:00.000Z,
            },
            "runtimeContext": {},
            "stepNumber": 0,
            "toolsContext": {},
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
            "warnings": [],
          },
        ]
      `);
    });

    it('should add reasoning-files from the model response to the step result', async () => {
      const result = streamText({
        model: modelWithReasoningFiles,
        ...defaultSettings(),
      });

      expect(await result.steps).toMatchInlineSnapshot(`
        [
          DefaultStepResult {
            "callId": "test-telemetry-call-id",
            "content": [
              {
                "file": DefaultGeneratedFileWithType {
                  "base64Data": "reasoning-file-data-1",
                  "mediaType": "image/png",
                  "type": "file",
                  "uint8ArrayData": undefined,
                },
                "type": "reasoning-file",
              },
              {
                "providerMetadata": undefined,
                "text": "Some reasoning text.",
                "type": "reasoning",
              },
              {
                "file": DefaultGeneratedFileWithType {
                  "base64Data": "reasoning-file-data-2",
                  "mediaType": "image/jpeg",
                  "type": "file",
                  "uint8ArrayData": undefined,
                },
                "providerMetadata": {
                  "testProvider": {
                    "signature": "rf-sig-1",
                  },
                },
                "type": "reasoning-file",
              },
              {
                "providerMetadata": undefined,
                "text": "Hello!",
                "type": "text",
              },
            ],
            "finishReason": "stop",
            "model": {
              "modelId": "mock-model-id",
              "provider": "mock-provider",
            },
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
            "request": {
              "body": undefined,
              "messages": undefined,
            },
            "response": {
              "headers": undefined,
              "id": "id-0",
              "messages": [
                {
                  "content": [
                    {
                      "data": "reasoning-file-data-1",
                      "mediaType": "image/png",
                      "providerOptions": undefined,
                      "type": "reasoning-file",
                    },
                    {
                      "providerOptions": undefined,
                      "text": "Some reasoning text.",
                      "type": "reasoning",
                    },
                    {
                      "data": "reasoning-file-data-2",
                      "mediaType": "image/jpeg",
                      "providerOptions": {
                        "testProvider": {
                          "signature": "rf-sig-1",
                        },
                      },
                      "type": "reasoning-file",
                    },
                    {
                      "providerOptions": undefined,
                      "text": "Hello!",
                      "type": "text",
                    },
                  ],
                  "role": "assistant",
                },
              ],
              "modelId": "mock-model-id",
              "timestamp": 1970-01-01T00:00:00.000Z,
            },
            "runtimeContext": {},
            "stepNumber": 0,
            "toolsContext": {},
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
            "warnings": [],
          },
        ]
      `);
    });

    it('should expose the final step', async () => {
      const result = streamText({
        model: createTestModel(),
        ...defaultSettings(),
      });

      const steps = await result.steps;

      await expect(result.finalStep).resolves.toBe(steps.at(-1));
    });

    it('should include step performance', async () => {
      const settings = defaultSettings();

      const result = streamText({
        model: createTestModel(),
        ...settings,
        _internal: {
          ...settings._internal,
          now: mockValues(1000, 1000, 1200, 1300, 1400, 1500, 1500, 1500),
        },
      });

      expect((await result.finalStep).performance).toStrictEqual({
        effectiveOutputTokensPerSecond: 20,
        outputTokensPerSecond: 33.333333333333336,
        inputTokensPerSecond: 15,
        effectiveTotalTokensPerSecond: 26,
        stepTimeMs: 500,
        responseTimeMs: 500,
        toolExecutionMs: {},
        timeToFirstOutputMs: 200,
        timeBetweenOutputChunksMs: {
          min: 100,
          p10: 100,
          median: 100,
          avg: 100,
          p90: 100,
          max: 100,
        },
      });
    });

    it('should measure output timing from tool input deltas and tool calls', async () => {
      const settings = defaultSettings();

      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'stream-start',
              warnings: [],
            },
            { type: 'tool-input-start', id: 'call-1', toolName: 'tool1' },
            { type: 'tool-input-delta', id: 'call-1', delta: '{' },
            { type: 'tool-input-end', id: 'call-1' },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: `{ "value": "value" }`,
            },
            {
              type: 'finish',
              finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
              usage: testUsage,
            },
          ]),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
          }),
        },
        ...settings,
        _internal: {
          ...settings._internal,
          now: mockValues(1000, 1000, 1100, 1200, 1500, 1500),
        },
      });

      expect((await result.finalStep).performance).toStrictEqual({
        effectiveOutputTokensPerSecond: 20,
        outputTokensPerSecond: 25,
        inputTokensPerSecond: 30,
        effectiveTotalTokensPerSecond: 26,
        stepTimeMs: 500,
        responseTimeMs: 500,
        toolExecutionMs: {},
        timeToFirstOutputMs: 100,
        timeBetweenOutputChunksMs: {
          min: 100,
          p10: 100,
          median: 100,
          avg: 100,
          p90: 100,
          max: 100,
        },
      });
    });
  });

  describe('result.toolCalls', () => {
    it('should resolve with tool calls', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: `{ "value": "value" }`,
            },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
          }),
        },
        prompt: 'test-input',
      });

      expect(await result.toolCalls).toMatchInlineSnapshot(`
        [
          {
            "input": {
              "value": "value",
            },
            "providerExecuted": undefined,
            "providerMetadata": undefined,
            "title": undefined,
            "toolCallId": "call-1",
            "toolName": "tool1",
            "type": "tool-call",
          },
        ]
      `);
    });

    it('should resolve with tool calls from all steps', async () => {
      let responseCount = 0;
      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'tool-call',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: `{ "value": "value-1" }`,
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'tool-calls', raw: undefined },
                      usage: testUsage,
                    },
                  ]),
                };
              case 1:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'tool-call',
                      toolCallId: 'call-2',
                      toolName: 'dynamicTool',
                      input: `{ "value": "value-2" }`,
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'tool-calls', raw: undefined },
                      usage: testUsage,
                    },
                  ]),
                };
              case 2:
                return {
                  stream: convertArrayToReadableStream([
                    { type: 'text-start', id: '1' },
                    { type: 'text-delta', id: '1', delta: 'done' },
                    { type: 'text-end', id: '1' },
                    {
                      type: 'finish',
                      finishReason: { unified: 'stop', raw: 'stop' },
                      usage: testUsage,
                    },
                  ]),
                };
              default:
                throw new Error(`Unexpected response count: ${responseCount}`);
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
          dynamicTool: dynamicTool({
            inputSchema: z.object({ value: z.string() }),
            execute: async () => `value-2-result`,
          }),
        },
        prompt: 'test-input',
        stopWhen: isStepCount(4),
      });

      expect(
        (await result.toolCalls).map(toolCall => toolCall.toolCallId),
      ).toEqual(['call-1', 'call-2']);
      expect(
        (await result.staticToolCalls).map(toolCall => toolCall.toolCallId),
      ).toEqual(['call-1']);
      expect(
        (await result.dynamicToolCalls).map(toolCall => toolCall.toolCallId),
      ).toEqual(['call-2']);
      await expect(result.finalStep).resolves.toMatchObject({
        toolCalls: [],
      });
    });
  });

  describe('result.toolResults', () => {
    it('should resolve with tool results', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: `{ "value": "value" }`,
            },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          },
        },
        prompt: 'test-input',
      });

      expect(await result.toolResults).toMatchInlineSnapshot(`
        [
          {
            "dynamic": false,
            "input": {
              "value": "value",
            },
            "output": "value-result",
            "toolCallId": "call-1",
            "toolName": "tool1",
            "type": "tool-result",
          },
        ]
      `);
    });

    it('should resolve with tool results from all steps', async () => {
      let responseCount = 0;
      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'tool-call',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: `{ "value": "value-1" }`,
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'tool-calls', raw: undefined },
                      usage: testUsage,
                    },
                  ]),
                };
              case 1:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'tool-call',
                      toolCallId: 'call-2',
                      toolName: 'dynamicTool',
                      input: `{ "value": "value-2" }`,
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'tool-calls', raw: undefined },
                      usage: testUsage,
                    },
                  ]),
                };
              case 2:
                return {
                  stream: convertArrayToReadableStream([
                    { type: 'text-start', id: '1' },
                    { type: 'text-delta', id: '1', delta: 'done' },
                    { type: 'text-end', id: '1' },
                    {
                      type: 'finish',
                      finishReason: { unified: 'stop', raw: 'stop' },
                      usage: testUsage,
                    },
                  ]),
                };
              default:
                throw new Error(`Unexpected response count: ${responseCount}`);
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
          dynamicTool: dynamicTool({
            inputSchema: z.object({ value: z.string() }),
            execute: async () => `value-2-result`,
          }),
        },
        prompt: 'test-input',
        stopWhen: isStepCount(4),
      });

      expect(
        (await result.toolResults).map(toolResult => toolResult.toolCallId),
      ).toEqual(['call-1', 'call-2']);
      expect(
        (await result.staticToolResults).map(
          toolResult => toolResult.toolCallId,
        ),
      ).toEqual(['call-1']);
      expect(
        (await result.dynamicToolResults).map(
          toolResult => toolResult.toolCallId,
        ),
      ).toEqual(['call-2']);
      await expect(result.finalStep).resolves.toMatchObject({
        toolResults: [],
      });
    });
  });

  describe('options.onStart', () => {
    it('should send correct information with text prompt', async () => {
      let startEvent!: Parameters<GenerateTextOnStartCallback>[0];

      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        telemetry: {
          functionId: 'test-function',
        },
        onStart: async event => {
          startEvent = event;
        },
        onError: () => {},
        _internal: {
          generateId: () => 'test-call-id',
          generateCallId: () => 'test-telemetry-call-id',
        },
      });

      await result.consumeStream();

      expect(startEvent).toMatchSnapshot();
    });

    it('should accept deprecated experimental_telemetry as an alias for telemetry', async () => {
      let startEvent!: Parameters<GenerateTextOnStartCallback>[0];

      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        experimental_telemetry: {
          isEnabled: true,
          functionId: 'deprecated-fn',
        },
        onStart: async event => {
          startEvent = event;
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(startEvent).not.toHaveProperty('isEnabled');
      expect(startEvent).not.toHaveProperty('functionId');
    });

    it('should pass runtimeContext', async () => {
      let startEvent!: any;

      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        runtimeContext: { userId: 'test-user', sessionId: '123' },
        onStart: async event => {
          startEvent = event;
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(startEvent.runtimeContext).toEqual({
        userId: 'test-user',
        sessionId: '123',
      });
    });

    it('should pass full runtimeContext to callbacks', async () => {
      const callbackContexts: unknown[] = [];

      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        runtimeContext: {
          userId: 'user-123',
          requestId: 'request-123',
        },
        telemetry: {
          includeRuntimeContext: {
            requestId: true,
          },
        },
        onStart: async ({ runtimeContext }) => {
          callbackContexts.push(runtimeContext);
        },
        onStepStart: async ({ runtimeContext }) => {
          callbackContexts.push(runtimeContext);
        },
        onStepFinish: async ({ runtimeContext }) => {
          callbackContexts.push(runtimeContext);
        },
        onFinish: async ({ runtimeContext }) => {
          callbackContexts.push(runtimeContext);
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(callbackContexts).toEqual([
        { userId: 'user-123', requestId: 'request-123' },
        { userId: 'user-123', requestId: 'request-123' },
        { userId: 'user-123', requestId: 'request-123' },
        { userId: 'user-123', requestId: 'request-123' },
      ]);
    });

    it('should include configured runtimeContext properties in telemetry', async () => {
      const telemetryContexts: unknown[] = [];

      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        runtimeContext: {
          userId: 'user-123',
          requestId: 'request-123',
        },
        telemetry: {
          includeRuntimeContext: {
            requestId: true,
          },
          integrations: {
            onStart: async event => {
              telemetryContexts.push(
                (event as { runtimeContext: unknown }).runtimeContext,
              );
            },
            onStepStart: async ({ runtimeContext }) => {
              telemetryContexts.push(runtimeContext);
            },
            onStepEnd: async ({ runtimeContext }) => {
              telemetryContexts.push(runtimeContext);
            },
            onEnd: async event => {
              telemetryContexts.push(
                (event as { runtimeContext: unknown }).runtimeContext,
              );
            },
          },
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(telemetryContexts).toEqual([
        { requestId: 'request-123' },
        { requestId: 'request-123' },
        { requestId: 'request-123' },
        { requestId: 'request-123' },
      ]);
    });

    it('should include configured toolsContext properties in telemetry', async () => {
      const telemetryContexts: unknown[] = [];
      const tools = {
        weather: tool({
          inputSchema: z.object({ city: z.string() }),
          contextSchema: z.object({
            apiKey: z.string(),
            region: z.string(),
          }),
          execute: async () => 'sunny',
        }),
      };

      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        tools,
        toolsContext: {
          weather: {
            apiKey: 'secret-api-key',
            region: 'eu',
          },
        },
        telemetry: {
          includeToolsContext: {
            weather: {
              region: true,
            },
          },
          integrations: {
            onStart: async event => {
              telemetryContexts.push(
                (event as { toolsContext: unknown }).toolsContext,
              );
            },
            onStepStart: async ({ toolsContext }) => {
              telemetryContexts.push(toolsContext);
            },
            onStepEnd: async ({ toolsContext }) => {
              telemetryContexts.push(toolsContext);
            },
            onEnd: async event => {
              telemetryContexts.push(
                (event as { toolsContext: unknown }).toolsContext,
              );
            },
          },
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(telemetryContexts).toEqual([
        { weather: { region: 'eu' } },
        { weather: { region: 'eu' } },
        { weather: { region: 'eu' } },
        { weather: { region: 'eu' } },
      ]);
    });

    it('should exclude runtimeContext from telemetry by default', async () => {
      const telemetryContexts: unknown[] = [];

      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        runtimeContext: {
          userId: 'user-123',
          requestId: 'request-123',
        },
        telemetry: {
          integrations: {
            onStart: async event => {
              telemetryContexts.push(
                (event as { runtimeContext: unknown }).runtimeContext,
              );
            },
            onStepStart: async ({ runtimeContext }) => {
              telemetryContexts.push(runtimeContext);
            },
            onStepEnd: async ({ runtimeContext }) => {
              telemetryContexts.push(runtimeContext);
            },
            onEnd: async event => {
              telemetryContexts.push(
                (event as { runtimeContext: unknown }).runtimeContext,
              );
            },
          },
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(telemetryContexts).toEqual([{}, {}, {}, {}]);
    });

    it('should send correct information with system and messages', async () => {
      let startEvent!: Parameters<GenerateTextOnStartCallback>[0];

      const result = streamText({
        model: createTestModel(),
        instructions: 'you are a helpful assistant',
        messages: [{ role: 'user', content: 'test-message' }],
        maxOutputTokens: 100,
        temperature: 0.5,
        onStart: async event => {
          startEvent = event;
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(startEvent.provider).toBe('mock-provider');
      expect(startEvent.modelId).toBe('mock-model-id');
      expect(startEvent.instructions).toBe('you are a helpful assistant');
      // expect(startEvent.prompt).toBeUndefined();
      expect(startEvent.messages).toEqual([
        { role: 'user', content: 'test-message' },
      ]);
      expect(startEvent.maxOutputTokens).toBe(100);
      expect(startEvent.temperature).toBe(0.5);
      expect(startEvent.maxRetries).toBe(2);
    });

    it('should be called before doStream', async () => {
      const callOrder: string[] = [];

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            callOrder.push('doStream');
            return {
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello!' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        prompt: 'test-input',
        onStart: async () => {
          callOrder.push('onStart');
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(callOrder).toEqual(['onStart', 'doStream']);
    });

    it('should not break generation when callback throws', async () => {
      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        onStart: async () => {
          throw new Error('callback error');
        },
        onError: () => {},
      });

      expect(await result.text).toBe('Hello, world!');
    });

    it('should expose tools and toolChoice', async () => {
      let startEvent!: Parameters<GenerateTextOnStartCallback<any>>[0];

      const testTool = tool({
        inputSchema: z.object({ value: z.string() }),
      });

      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        tools: { myTool: testTool },
        toolChoice: 'auto',
        onStart: async event => {
          startEvent = event;
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(startEvent.tools).toEqual({ myTool: testTool });
      expect(startEvent.toolChoice).toBe('auto');
    });

    it('should expose providerOptions', async () => {
      let startEvent!: Parameters<GenerateTextOnStartCallback>[0];

      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        providerOptions: { openai: { logprobs: true } },
        onStart: async event => {
          startEvent = event;
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(startEvent.providerOptions).toEqual({
        openai: { logprobs: true },
      });
    });

    it('should expose timeout and stopWhen', async () => {
      let startEvent!: Parameters<GenerateTextOnStartCallback>[0];

      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        timeout: { totalMs: 5000, stepMs: 1000 },
        stopWhen: isStepCount(3),
        onStart: async event => {
          startEvent = event;
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(startEvent.timeout).toEqual({ totalMs: 5000, stepMs: 1000 });
    });
  });

  describe('options.onStepStart', () => {
    it('should be called with correct data for a single step', async () => {
      let stepStartEvent!: Parameters<
        GenerateTextOnStepStartCallback<any, any>
      >[0];

      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        onStepStart: async event => {
          stepStartEvent = event;
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(stepStartEvent.stepNumber).toBe(0);
      expect(stepStartEvent.steps.length).toBe(0);
      expect(stepStartEvent.provider).toBe('mock-provider');
      expect(stepStartEvent.modelId).toBe('mock-model-id');
      expect(stepStartEvent.messages).toEqual([
        {
          role: 'user',
          content: 'test-input',
        },
      ]);
      expect(stepStartEvent.steps).toEqual([]);
    });

    it('should be called once per step in a multi-step tool loop', async () => {
      const stepStartEvents: Parameters<
        GenerateTextOnStepStartCallback<any, any>
      >[0][] = [];
      let responseCount = 0;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'response-metadata' as const,
                      id: 'id-0',
                      modelId: 'mock-model-id',
                      timestamp: new Date(0),
                    },
                    {
                      type: 'tool-call' as const,
                      id: 'call-1',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{ "value": "test" }',
                    },
                    {
                      type: 'finish' as const,
                      finishReason: {
                        unified: 'tool-calls' as const,
                        raw: undefined,
                      },
                      usage: testUsage,
                    },
                  ]),
                };
              case 1:
              default:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'response-metadata' as const,
                      id: 'id-1',
                      modelId: 'mock-model-id',
                      timestamp: new Date(1000),
                    },
                    { type: 'text-start' as const, id: '1' },
                    {
                      type: 'text-delta' as const,
                      id: '1',
                      delta: 'Final answer.',
                    },
                    { type: 'text-end' as const, id: '1' },
                    {
                      type: 'finish' as const,
                      finishReason: {
                        unified: 'stop' as const,
                        raw: 'stop',
                      },
                      usage: testUsage,
                    },
                  ]),
                };
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        stopWhen: isStepCount(3),
        onStepStart: async event => {
          stepStartEvents.push(event);
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(stepStartEvents.length).toBe(2);
      expect(stepStartEvents[0].stepNumber).toBe(0);
      expect(stepStartEvents[0].steps.length).toBe(0);
      expect(stepStartEvents[1].stepNumber).toBe(1);
      expect(stepStartEvents[1].steps.length).toBe(1);
    });

    it('should be called before doStream on each step', async () => {
      const callOrder: string[] = [];

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            callOrder.push('doStream');
            return {
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello!' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        prompt: 'test-input',
        onStepStart: async () => {
          callOrder.push('onStepStart');
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(callOrder).toEqual(['onStepStart', 'doStream']);
    });

    it('should not break generation when callback throws', async () => {
      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        onStepStart: async () => {
          throw new Error('callback error');
        },
        onError: () => {},
      });

      expect(await result.text).toBe('Hello, world!');
    });

    it('should reflect model changes from prepareStep', async () => {
      const stepStartEvents: Parameters<
        GenerateTextOnStepStartCallback<any, any>
      >[0][] = [];
      let responseCount = 0;

      const alternateModel = new MockLanguageModelV4({
        provider: 'alternate-provider',
        modelId: 'alternate-model-id',
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata' as const,
              id: 'id-1',
              modelId: 'alternate-model-id',
              timestamp: new Date(1000),
            },
            { type: 'text-start' as const, id: '1' },
            { type: 'text-delta' as const, id: '1', delta: 'Final answer.' },
            { type: 'text-end' as const, id: '1' },
            {
              type: 'finish' as const,
              finishReason: { unified: 'stop' as const, raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
      });

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            responseCount++;
            return {
              stream: convertArrayToReadableStream([
                {
                  type: 'response-metadata' as const,
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                {
                  type: 'tool-call' as const,
                  id: 'call-1',
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  input: '{ "value": "test" }',
                },
                {
                  type: 'finish' as const,
                  finishReason: {
                    unified: 'tool-calls' as const,
                    raw: undefined,
                  },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        stopWhen: isStepCount(3),
        prepareStep: async ({ stepNumber }) => {
          if (stepNumber === 1) {
            return { model: alternateModel };
          }
          return undefined;
        },
        onStepStart: async event => {
          stepStartEvents.push(event);
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(stepStartEvents[0].provider).toBe('mock-provider');
      expect(stepStartEvents[0].modelId).toBe('mock-model-id');
      expect(stepStartEvents[1].provider).toBe('alternate-provider');
      expect(stepStartEvents[1].modelId).toBe('alternate-model-id');
    });

    it('should expose providerOptions and runtimeContext', async () => {
      let stepStartEvent!: Parameters<
        GenerateTextOnStepStartCallback<any, any>
      >[0];

      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        providerOptions: { openai: { logprobs: true } },
        runtimeContext: { userId: 'test-user' },
        onStepStart: async event => {
          stepStartEvent = event;
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(stepStartEvent.providerOptions).toEqual({
        openai: { logprobs: true },
      });
      expect(stepStartEvent.runtimeContext).toEqual({
        userId: 'test-user',
      });
    });

    it('should not expose telemetry metadata in onStepStart', async () => {
      let stepStartEvent!: Parameters<
        GenerateTextOnStepStartCallback<any, any>
      >[0];

      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        telemetry: {
          functionId: 'test-function',
        },
        onStepStart: async event => {
          stepStartEvent = event;
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(stepStartEvent).not.toHaveProperty('functionId');
    });

    it('should pass initialInstructions, initialMessages, and responseMessages to prepareStep', async () => {
      const prepareStepCalls: Array<{
        instructions: Instructions | undefined;
        initialInstructions: Instructions | undefined;
        initialMessages: Array<ModelMessage>;
        responseMessages: Array<ModelMessage>;
        messages: Array<ModelMessage>;
      }> = [];
      let responseCount = 0;

      const model = new MockLanguageModelV4({
        doStream: async () => {
          switch (responseCount++) {
            case 0:
              return {
                stream: convertArrayToReadableStream([
                  {
                    type: 'response-metadata' as const,
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  {
                    type: 'tool-call' as const,
                    id: 'call-1',
                    toolCallId: 'call-1',
                    toolName: 'tool1',
                    input: '{ "value": "test" }',
                  },
                  {
                    type: 'finish' as const,
                    finishReason: {
                      unified: 'tool-calls' as const,
                      raw: undefined,
                    },
                    usage: testUsage,
                  },
                ]),
              };
            case 1:
            default:
              return {
                stream: convertArrayToReadableStream([
                  {
                    type: 'response-metadata' as const,
                    id: 'id-1',
                    modelId: 'mock-model-id',
                    timestamp: new Date(1000),
                  },
                  { type: 'text-start' as const, id: '1' },
                  { type: 'text-delta' as const, id: '1', delta: 'Done.' },
                  { type: 'text-end' as const, id: '1' },
                  {
                    type: 'finish' as const,
                    finishReason: { unified: 'stop' as const, raw: 'stop' },
                    usage: testUsage,
                  },
                ]),
              };
          }
        },
      });

      const result = streamText({
        model,
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        instructions: 'test instructions',
        messages: [{ role: 'user', content: 'test-input' }],
        stopWhen: isStepCount(3),
        prepareStep: async ({
          instructions,
          initialInstructions,
          initialMessages,
          responseMessages,
          messages,
          stepNumber,
        }) => {
          prepareStepCalls.push({
            instructions,
            initialInstructions,
            initialMessages: [...initialMessages],
            responseMessages: [...responseMessages],
            messages: [...messages],
          });

          return stepNumber === 0
            ? { instructions: 'prepared instructions' }
            : undefined;
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(prepareStepCalls).toHaveLength(2);
      expect(prepareStepCalls[0].instructions).toBe('test instructions');
      expect(prepareStepCalls[0].initialInstructions).toBe('test instructions');
      expect(prepareStepCalls[0].initialMessages).toEqual([
        { role: 'user', content: 'test-input' },
      ]);
      expect(prepareStepCalls[0].responseMessages).toEqual([]);
      expect(prepareStepCalls[0].messages).toEqual([
        { role: 'user', content: 'test-input' },
      ]);

      expect(prepareStepCalls[1].instructions).toBe('prepared instructions');
      expect(prepareStepCalls[1].initialInstructions).toBe('test instructions');
      expect(prepareStepCalls[1].initialMessages).toEqual([
        { role: 'user', content: 'test-input' },
      ]);
      expect(prepareStepCalls[1].responseMessages).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "input": {
                  "value": "test",
                },
                "providerExecuted": undefined,
                "providerOptions": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "output": {
                  "type": "text",
                  "value": "test-result",
                },
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-result",
              },
            ],
            "role": "tool",
          },
        ]
      `);
      expect(prepareStepCalls[1].messages).toEqual([
        ...prepareStepCalls[1].initialMessages,
        ...prepareStepCalls[1].responseMessages,
      ]);
      expect(model.doStreamCalls[1].prompt[0]).toEqual({
        role: 'system',
        content: 'prepared instructions',
      });
    });

    it('should pass updated toolsContext from prepareStep', async () => {
      const prepareStepToolsContexts: Array<unknown> = [];
      const stepStartEvents: Parameters<
        GenerateTextOnStepStartCallback<any, any>
      >[0][] = [];
      let responseCount = 0;
      let recordedToolContext: unknown;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'response-metadata' as const,
                      id: 'id-0',
                      modelId: 'mock-model-id',
                      timestamp: new Date(0),
                    },
                    {
                      type: 'tool-call' as const,
                      id: 'call-1',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{ "value": "test" }',
                    },
                    {
                      type: 'finish' as const,
                      finishReason: {
                        unified: 'tool-calls' as const,
                        raw: undefined,
                      },
                      usage: testUsage,
                    },
                  ]),
                };
              case 1:
              default:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'response-metadata' as const,
                      id: 'id-1',
                      modelId: 'mock-model-id',
                      timestamp: new Date(1000),
                    },
                    { type: 'text-start' as const, id: '1' },
                    { type: 'text-delta' as const, id: '1', delta: 'Done.' },
                    { type: 'text-end' as const, id: '1' },
                    {
                      type: 'finish' as const,
                      finishReason: { unified: 'stop' as const, raw: 'stop' },
                      usage: testUsage,
                    },
                  ]),
                };
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            contextSchema: z.object({ label: z.string() }),
            execute: async (_, { context }) => {
              recordedToolContext = context;
              return 'test-result';
            },
          }),
        },
        prompt: 'test-input',
        toolsContext: { tool1: { label: 'initial' } },
        stopWhen: isStepCount(3),
        prepareStep: async ({ stepNumber, toolsContext }) => {
          prepareStepToolsContexts.push(toolsContext);

          if (stepNumber === 0) {
            return {
              toolsContext: {
                tool1: { label: 'updated' },
              },
            };
          }

          return undefined;
        },
        onStepStart: async event => {
          stepStartEvents.push(event);
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(prepareStepToolsContexts).toEqual([
        { tool1: { label: 'initial' } },
        { tool1: { label: 'updated' } },
      ]);
      expect(stepStartEvents[0].toolsContext).toEqual({
        tool1: { label: 'updated' },
      });
      expect(stepStartEvents[1].toolsContext).toEqual({
        tool1: { label: 'updated' },
      });
      expect(recordedToolContext).toEqual({ label: 'updated' });
    });
  });

  describe('options.onLanguageModelCallStart and onLanguageModelCallEnd', () => {
    it('should fire the model-call callbacks before tool execution and step finish', async () => {
      const callOrder: string[] = [];
      const modelCallEndEvents: LanguageModelCallEndEvent<any>[] = [];

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'response-1',
                modelId: 'response-model',
                timestamp: new Date('2025-01-01T00:00:00.000Z'),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Before tool.' },
              { type: 'text-end', id: '1' },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test-arg" }',
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        onStepStart: async () => {
          callOrder.push('onStepStart');
        },
        onLanguageModelCallStart: async () => {
          callOrder.push('onLanguageModelCallStart');
        },
        onLanguageModelCallEnd: async event => {
          callOrder.push('onLanguageModelCallEnd');
          modelCallEndEvents.push(event);
        },
        onToolExecutionStart: async () => {
          callOrder.push('onToolExecutionStart');
        },
        onToolExecutionEnd: async () => {
          callOrder.push('onToolExecutionEnd');
        },
        onStepFinish: async () => {
          callOrder.push('onStepFinish');
        },
        onError: () => {},
        _internal: {
          generateCallId: () => 'test-telemetry-call-id',
        },
      });

      await result.consumeStream();

      expect(callOrder).toEqual([
        'onStepStart',
        'onLanguageModelCallStart',
        'onLanguageModelCallEnd',
        'onToolExecutionStart',
        'onToolExecutionEnd',
        'onStepFinish',
      ]);
      expect(modelCallEndEvents).toMatchInlineSnapshot(`
        [
          {
            "callId": "test-telemetry-call-id",
            "content": [
              {
                "text": "Before tool.",
                "type": "text",
              },
              {
                "input": {
                  "value": "test-arg",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
            ],
            "finishReason": "tool-calls",
            "modelId": "mock-model-id",
            "performance": {
              "effectiveOutputTokensPerSecond": 0,
              "effectiveTotalTokensPerSecond": 0,
              "inputTokensPerSecond": 0,
              "outputTokensPerSecond": 0,
              "responseTimeMs": 0,
              "timeBetweenOutputChunksMs": {
                "avg": 0,
                "max": 0,
                "median": 0,
                "min": 0,
                "p10": 0,
                "p90": 0,
              },
              "timeToFirstOutputMs": 0,
            },
            "provider": "mock-provider",
            "responseId": "response-1",
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
    });
  });

  describe('options.onToolExecutionStart', () => {
    it('should use experimental_onToolCallStart as a fallback', async () => {
      const callOrder: string[] = [];

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        experimental_onToolCallStart: async () => {
          callOrder.push('experimental_onToolCallStart');
        },
        ...defaultSettings(),
      });

      await result.consumeStream();

      expect(callOrder).toEqual(['experimental_onToolCallStart']);
    });

    it('should prefer onToolExecutionStart over experimental_onToolCallStart', async () => {
      const callOrder: string[] = [];

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        experimental_onToolCallStart: async () => {
          callOrder.push('experimental_onToolCallStart');
        },
        onToolExecutionStart: async () => {
          callOrder.push('onToolExecutionStart');
        },
        ...defaultSettings(),
      });

      await result.consumeStream();

      expect(callOrder).toEqual(['onToolExecutionStart']);
    });

    it('should be called with correct tool name, id, and input', async () => {
      const toolExecutionStartEvents: Parameters<
        OnToolExecutionStartCallback<any>
      >[0][] = [];

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test-arg" }',
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        onToolExecutionStart: async event => {
          toolExecutionStartEvents.push(event);
        },
        onError: () => {},
        _internal: {
          generateId: () => 'test-call-id',
          generateCallId: () => 'test-telemetry-call-id',
        },
      });

      await result.consumeStream();

      expect(toolExecutionStartEvents).toMatchInlineSnapshot(`
        [
          {
            "callId": "test-telemetry-call-id",
            "messages": [
              {
                "content": "test-input",
                "role": "user",
              },
            ],
            "toolCall": {
              "input": {
                "value": "test-arg",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
            "toolContext": undefined,
          },
        ]
      `);
    });

    it('should be called once per tool call in a multi-tool step', async () => {
      const toolExecutionStartEvents: Parameters<
        OnToolExecutionStartCallback<any>
      >[0][] = [];

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "a" }',
              },
              {
                type: 'tool-call',
                toolCallId: 'call-2',
                toolName: 'tool1',
                input: '{ "value": "b" }',
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        onToolExecutionStart: async event => {
          toolExecutionStartEvents.push(event);
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(toolExecutionStartEvents.length).toMatchInlineSnapshot(`2`);
    });

    it('should be called before tool execution', async () => {
      const callOrder: string[] = [];

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => {
              callOrder.push('execute');
              return `${value}-result`;
            },
          }),
        },
        prompt: 'test-input',
        onToolExecutionStart: async () => {
          callOrder.push('onToolExecutionStart');
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(callOrder.indexOf('onToolExecutionStart')).toBeLessThan(
        callOrder.indexOf('execute'),
      );
    });

    it('should not break generation when callback throws', async () => {
      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        onToolExecutionStart: async () => {
          throw new Error('callback error');
        },
        onError: () => {},
      });

      await result.consumeStream();

      const toolResults = await result.toolResults;
      expect(toolResults.length).toBe(1);
      expect(toolResults[0].output).toBe('test-result');
    });

    it('should not fire for tools without execute', async () => {
      const toolExecutionStartEvents: Parameters<
        OnToolExecutionStartCallback<any>
      >[0][] = [];

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
          }),
        },
        prompt: 'test-input',
        onToolExecutionStart: async event => {
          toolExecutionStartEvents.push(event);
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(toolExecutionStartEvents.length).toBe(0);
    });

    it('should pass context', async () => {
      const toolExecutionStartEvents: Parameters<
        OnToolExecutionStartCallback<any>
      >[0][] = [];

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            contextSchema: z.object({ context: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        toolsContext: { tool1: { context: 'test' } },
        onToolExecutionStart: async event => {
          toolExecutionStartEvents.push(event);
        },
        ...defaultSettings(),
      });

      await result.consumeStream();

      expect(toolExecutionStartEvents).toMatchInlineSnapshot(`
        [
          {
            "callId": "test-telemetry-call-id",
            "messages": [
              {
                "content": "prompt",
                "role": "user",
              },
            ],
            "toolCall": {
              "input": {
                "value": "test",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
            "toolContext": {
              "context": "test",
            },
          },
        ]
      `);
    });
  });

  describe('options.onToolExecutionEnd', () => {
    it('should use experimental_onToolCallFinish as a fallback', async () => {
      const callOrder: string[] = [];

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        experimental_onToolCallFinish: async () => {
          callOrder.push('experimental_onToolCallFinish');
        },
        ...defaultSettings(),
      });

      await result.consumeStream();

      expect(callOrder).toEqual(['experimental_onToolCallFinish']);
    });

    it('should prefer onToolExecutionEnd over experimental_onToolCallFinish', async () => {
      const callOrder: string[] = [];

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        experimental_onToolCallFinish: async () => {
          callOrder.push('experimental_onToolCallFinish');
        },
        onToolExecutionEnd: async () => {
          callOrder.push('onToolExecutionEnd');
        },
        ...defaultSettings(),
      });

      await result.consumeStream();

      expect(callOrder).toEqual(['onToolExecutionEnd']);
    });

    it('should be called with correct data on success', async () => {
      const toolExecutionEndEvents: Parameters<
        OnToolExecutionEndCallback<any>
      >[0][] = [];

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test-arg" }',
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        onToolExecutionEnd: async event => {
          toolExecutionEndEvents.push(event);
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(toolExecutionEndEvents.length).toMatchInlineSnapshot(`1`);
    });

    it('should be called with error data when tool execution fails', async () => {
      const toolExecutionEndEvents: Parameters<
        OnToolExecutionEndCallback<any>
      >[0][] = [];
      const toolError = new Error('tool execution failed');

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async (): Promise<string> => {
              throw toolError;
            },
          }),
        },
        prompt: 'test-input',
        onToolExecutionEnd: async event => {
          toolExecutionEndEvents.push(event);
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(toolExecutionEndEvents.length).toBe(1);
      expect(toolExecutionEndEvents[0].toolCall.toolName).toBe('tool1');
      expect(toolExecutionEndEvents[0].toolCall.toolCallId).toBe('call-1');
      expect(toolExecutionEndEvents[0].toolOutput.type).toBe('tool-error');
      expect(
        (toolExecutionEndEvents[0].toolOutput as { error: unknown }).error,
      ).toBe(toolError);
      expect(toolExecutionEndEvents[0].toolExecutionMs).toBeGreaterThanOrEqual(
        0,
      );
    });

    it('should have a positive toolExecutionMs', async () => {
      const toolExecutionEndEvents: Parameters<
        OnToolExecutionEndCallback<any>
      >[0][] = [];

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        onToolExecutionEnd: async event => {
          toolExecutionEndEvents.push(event);
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(toolExecutionEndEvents[0].toolExecutionMs).toBeGreaterThanOrEqual(
        0,
      );
      expect(typeof toolExecutionEndEvents[0].toolExecutionMs).toBe('number');
    });

    it('should not break generation when callback throws', async () => {
      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        onToolExecutionEnd: async () => {
          throw new Error('callback error');
        },
        onError: () => {},
      });

      await result.consumeStream();

      const toolResults = await result.toolResults;
      expect(toolResults.length).toBe(1);
      expect(toolResults[0].output).toBe('test-result');
    });

    it('should not fire for tools without execute', async () => {
      const toolExecutionEndEvents: Parameters<
        OnToolExecutionEndCallback<any>
      >[0][] = [];

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
          }),
        },
        prompt: 'test-input',
        onToolExecutionEnd: async event => {
          toolExecutionEndEvents.push(event);
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(toolExecutionEndEvents.length).toBe(0);
    });

    it('should pass context on success', async () => {
      const toolExecutionEndEvents: Parameters<
        OnToolExecutionEndCallback<any>
      >[0][] = [];

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            contextSchema: z.object({ context: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        toolsContext: { tool1: { context: 'test' } },
        onToolExecutionEnd: async event => {
          toolExecutionEndEvents.push(event);
        },
        ...defaultSettings(),
      });

      await result.consumeStream();

      expect(toolExecutionEndEvents).toMatchInlineSnapshot(`
        [
          {
            "callId": "test-telemetry-call-id",
            "messages": [
              {
                "content": "prompt",
                "role": "user",
              },
            ],
            "toolCall": {
              "input": {
                "value": "test",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
            "toolContext": {
              "context": "test",
            },
            "toolExecutionMs": 0,
            "toolOutput": {
              "dynamic": false,
              "input": {
                "value": "test",
              },
              "output": "test-result",
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-result",
            },
          },
        ]
      `);
    });

    it('should pass context on error', async () => {
      const toolExecutionEndEvents: Parameters<
        OnToolExecutionEndCallback<any>
      >[0][] = [];
      const toolError = new Error('Tool execution failed');

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            contextSchema: z.object({ context: z.string() }),
            execute: async (): Promise<string> => {
              throw toolError;
            },
          }),
        },
        toolsContext: { tool1: { context: 'test' } },
        onToolExecutionEnd: async event => {
          toolExecutionEndEvents.push(event);
        },
        ...defaultSettings(),
      });

      await result.consumeStream();

      expect(toolExecutionEndEvents).toMatchInlineSnapshot(`
        [
          {
            "callId": "test-telemetry-call-id",
            "messages": [
              {
                "content": "prompt",
                "role": "user",
              },
            ],
            "toolCall": {
              "input": {
                "value": "test",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
            "toolContext": {
              "context": "test",
            },
            "toolExecutionMs": 0,
            "toolOutput": {
              "dynamic": false,
              "error": [Error: Tool execution failed],
              "input": {
                "value": "test",
              },
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-error",
            },
          },
        ]
      `);
    });
  });

  describe('options.onToolExecutionStart and onToolExecutionEnd ordering', () => {
    it('should call start before finish', async () => {
      const callOrder: string[] = [];

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        onToolExecutionStart: async () => {
          callOrder.push('onToolExecutionStart');
        },
        onToolExecutionEnd: async () => {
          callOrder.push('onToolExecutionEnd');
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(callOrder).toEqual(['onToolExecutionStart', 'onToolExecutionEnd']);
    });

    it('should fire tool call callbacks for each tool in a multi-step loop', async () => {
      const toolExecutionStartEvents: Parameters<
        OnToolExecutionStartCallback<any>
      >[0][] = [];
      const toolExecutionEndEvents: Parameters<
        OnToolExecutionEndCallback<any>
      >[0][] = [];
      let callCount = 0;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            switch (callCount++) {
              case 0:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'response-metadata',
                      id: 'id-0',
                      modelId: 'mock-model-id',
                      timestamp: new Date(0),
                    },
                    {
                      type: 'tool-call',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{ "value": "step0" }',
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'tool-calls', raw: undefined },
                      usage: testUsage,
                    },
                  ]),
                };
              case 1:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'response-metadata',
                      id: 'id-1',
                      modelId: 'mock-model-id',
                      timestamp: new Date(0),
                    },
                    {
                      type: 'tool-call',
                      toolCallId: 'call-2',
                      toolName: 'tool1',
                      input: '{ "value": "step1" }',
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'tool-calls', raw: undefined },
                      usage: testUsage,
                    },
                  ]),
                };
              case 2:
              default:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'response-metadata',
                      id: 'id-2',
                      modelId: 'mock-model-id',
                      timestamp: new Date(0),
                    },
                    { type: 'text-start', id: '1' },
                    { type: 'text-delta', id: '1', delta: 'Done.' },
                    { type: 'text-end', id: '1' },
                    {
                      type: 'finish',
                      finishReason: { unified: 'stop', raw: 'stop' },
                      usage: testUsage,
                    },
                  ]),
                };
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        stopWhen: isStepCount(4),
        onToolExecutionStart: async event => {
          toolExecutionStartEvents.push(event);
        },
        onToolExecutionEnd: async event => {
          toolExecutionEndEvents.push(event);
        },
        onError: () => {},
      });

      await result.consumeStream();

      expect(toolExecutionStartEvents.length).toMatchInlineSnapshot(`2`);
      expect(toolExecutionEndEvents.length).toMatchInlineSnapshot(`2`);
    });
  });

  describe('options.onChunk', () => {
    let result: Array<TextStreamPart<any>>;

    beforeEach(async () => {
      result = [];

      const resultObject = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-end', id: '1' },
            { type: 'tool-input-start', id: '2', toolName: 'tool1' },
            { type: 'tool-input-delta', id: '2', delta: '{"value": "' },
            { type: 'reasoning-start', id: '3' },
            { type: 'reasoning-delta', id: '3', delta: 'Feeling clever' },
            { type: 'reasoning-end', id: '3' },
            { type: 'tool-input-delta', id: '2', delta: 'test' },
            { type: 'tool-input-delta', id: '2', delta: '"}' },
            {
              type: 'source',
              sourceType: 'url',
              id: '123',
              url: 'https://example.com',
              title: 'Example',
              providerMetadata: { provider: { custom: 'value' } },
            },
            { type: 'tool-input-end', id: '2' },
            {
              type: 'tool-call',
              toolCallId: '2',
              toolName: 'tool1',
              input: `{ "value": "test" }`,
              providerMetadata: { provider: { custom: 'value' } },
            },
            { type: 'text-start', id: '4' },
            { type: 'text-delta', id: '4', delta: ' World' },
            { type: 'text-end', id: '4' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage2,
            },
          ]),
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          },
        },
        prompt: 'test-input',
        _internal: {
          generateId: mockId({ prefix: 'id' }),
          generateCallId: () => 'test-telemetry-call-id',
        },
        onChunk(event) {
          result.push(event.chunk);
        },
      });

      await resultObject.consumeStream();
    });

    it('should return events in order', async () => {
      expect(result).toMatchInlineSnapshot(`
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
            "id": "1",
            "type": "text-start",
          },
          {
            "id": "1",
            "providerMetadata": undefined,
            "text": "Hello",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
          {
            "dynamic": false,
            "id": "2",
            "title": undefined,
            "toolName": "tool1",
            "type": "tool-input-start",
          },
          {
            "delta": "{"value": "",
            "id": "2",
            "type": "tool-input-delta",
          },
          {
            "id": "3",
            "type": "reasoning-start",
          },
          {
            "id": "3",
            "providerMetadata": undefined,
            "text": "Feeling clever",
            "type": "reasoning-delta",
          },
          {
            "id": "3",
            "type": "reasoning-end",
          },
          {
            "delta": "test",
            "id": "2",
            "type": "tool-input-delta",
          },
          {
            "delta": ""}",
            "id": "2",
            "type": "tool-input-delta",
          },
          {
            "id": "123",
            "providerMetadata": {
              "provider": {
                "custom": "value",
              },
            },
            "sourceType": "url",
            "title": "Example",
            "type": "source",
            "url": "https://example.com",
          },
          {
            "id": "2",
            "type": "tool-input-end",
          },
          {
            "input": {
              "value": "test",
            },
            "providerExecuted": undefined,
            "providerMetadata": {
              "provider": {
                "custom": "value",
              },
            },
            "title": undefined,
            "toolCallId": "2",
            "toolName": "tool1",
            "type": "tool-call",
          },
          {
            "id": "4",
            "type": "text-start",
          },
          {
            "id": "4",
            "providerMetadata": undefined,
            "text": " World",
            "type": "text-delta",
          },
          {
            "id": "4",
            "type": "text-end",
          },
          {
            "dynamic": false,
            "input": {
              "value": "test",
            },
            "output": "test-result",
            "providerMetadata": {
              "provider": {
                "custom": "value",
              },
            },
            "toolCallId": "2",
            "toolName": "tool1",
            "type": "tool-result",
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
              "toolExecutionMs": {
                "2": 0,
              },
            },
            "providerMetadata": undefined,
            "rawFinishReason": "stop",
            "response": {
              "headers": undefined,
              "id": "id-0",
              "modelId": "mock-model-id",
              "timestamp": 1970-01-01T00:00:00.000Z,
            },
            "type": "finish-step",
            "usage": {
              "inputTokenDetails": {
                "cacheReadTokens": 0,
                "cacheWriteTokens": 0,
                "noCacheTokens": 3,
              },
              "inputTokens": 3,
              "outputTokenDetails": {
                "reasoningTokens": 10,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "raw": undefined,
              "totalTokens": 13,
            },
          },
          {
            "finishReason": "stop",
            "rawFinishReason": "stop",
            "totalUsage": {
              "inputTokenDetails": {
                "cacheReadTokens": 0,
                "cacheWriteTokens": 0,
                "noCacheTokens": 3,
              },
              "inputTokens": 3,
              "outputTokenDetails": {
                "reasoningTokens": 10,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "totalTokens": 13,
            },
            "type": "finish",
          },
        ]
      `);
    });

    it('should include custom parts in onChunk events', async () => {
      const chunks: Array<Record<string, unknown>> = [];

      const resultObject = streamText({
        model: modelWithCustom,
        prompt: 'test-input',
        _internal: {
          generateId: mockId({ prefix: 'id' }),
          generateCallId: () => 'test-telemetry-call-id',
        },
        onChunk(event) {
          chunks.push(event.chunk);
        },
      });

      await resultObject.consumeStream();

      expect(chunks).toMatchInlineSnapshot(`
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
            "id": "1",
            "type": "text-start",
          },
          {
            "id": "1",
            "providerMetadata": undefined,
            "text": "Hello!",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
          {
            "kind": "openai.compaction",
            "providerMetadata": {
              "openai": {
                "itemId": "cmp_123",
              },
            },
            "type": "custom",
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
              "timestamp": 1970-01-01T00:00:00.000Z,
            },
            "type": "finish-step",
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
            "finishReason": "stop",
            "rawFinishReason": "stop",
            "totalUsage": {
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
              "totalTokens": 13,
            },
            "type": "finish",
          },
        ]
      `);
    });
  });

  describe('options.onError', () => {
    it('should invoke onError', async () => {
      const result: Array<{ error: unknown }> = [];

      const resultObject = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            throw new Error('test error');
          },
        }),
        prompt: 'test-input',
        onError(event) {
          result.push(event);
        },
      });

      await resultObject.consumeStream();

      expect(result).toStrictEqual([{ error: new Error('test error') }]);
    });
  });

  describe('options.onEnd', () => {
    it('should send correct information', async () => {
      let result!: Parameters<GenerateTextOnEndCallback<any, any>>[0];

      const resultObject = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-delta', id: '1', delta: ', ' },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: `{ "value": "value" }`,
            },
            { type: 'text-delta', id: '1', delta: `world!` },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
              providerMetadata: {
                testProvider: { testKey: 'testValue' },
              },
            },
          ]),
          response: { headers: { call: '2' } },
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          },
        },
        onEnd: async event => {
          result = event as unknown as typeof result;
        },
        ...defaultSettings(),
      });

      await resultObject.consumeStream();

      expect(result).toMatchInlineSnapshot(`
        {
          "callId": "test-telemetry-call-id",
          "content": [
            {
              "providerMetadata": undefined,
              "text": "Hello, world!",
              "type": "text",
            },
            {
              "input": {
                "value": "value",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
            {
              "dynamic": false,
              "input": {
                "value": "value",
              },
              "output": "value-result",
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-result",
            },
          ],
          "dynamicToolCalls": [],
          "dynamicToolResults": [],
          "files": [],
          "finalStep": DefaultStepResult {
            "callId": "test-telemetry-call-id",
            "content": [
              {
                "providerMetadata": undefined,
                "text": "Hello, world!",
                "type": "text",
              },
              {
                "input": {
                  "value": "value",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
              {
                "dynamic": false,
                "input": {
                  "value": "value",
                },
                "output": "value-result",
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-result",
              },
            ],
            "finishReason": "stop",
            "model": {
              "modelId": "mock-model-id",
              "provider": "mock-provider",
            },
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
              "toolExecutionMs": {
                "call-1": 0,
              },
            },
            "providerMetadata": {
              "testProvider": {
                "testKey": "testValue",
              },
            },
            "rawFinishReason": "stop",
            "request": {
              "body": undefined,
              "messages": undefined,
            },
            "response": {
              "headers": {
                "call": "2",
              },
              "id": "id-0",
              "messages": [
                {
                  "content": [
                    {
                      "providerOptions": undefined,
                      "text": "Hello, world!",
                      "type": "text",
                    },
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "providerOptions": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                  ],
                  "role": "assistant",
                },
                {
                  "content": [
                    {
                      "output": {
                        "type": "text",
                        "value": "value-result",
                      },
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "role": "tool",
                },
              ],
              "modelId": "mock-model-id",
              "timestamp": 1970-01-01T00:00:00.000Z,
            },
            "runtimeContext": {},
            "stepNumber": 0,
            "toolsContext": {},
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
            "warnings": [],
          },
          "finishReason": "stop",
          "model": {
            "modelId": "mock-model-id",
            "provider": "mock-provider",
          },
          "providerMetadata": {
            "testProvider": {
              "testKey": "testValue",
            },
          },
          "rawFinishReason": "stop",
          "reasoning": [],
          "reasoningText": undefined,
          "request": {
            "body": undefined,
            "messages": undefined,
          },
          "response": {
            "headers": {
              "call": "2",
            },
            "id": "id-0",
            "messages": [
              {
                "content": [
                  {
                    "providerOptions": undefined,
                    "text": "Hello, world!",
                    "type": "text",
                  },
                  {
                    "input": {
                      "value": "value",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                ],
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "text",
                      "value": "value-result",
                    },
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "role": "tool",
              },
            ],
            "modelId": "mock-model-id",
            "timestamp": 1970-01-01T00:00:00.000Z,
          },
          "responseMessages": [
            {
              "content": [
                {
                  "providerOptions": undefined,
                  "text": "Hello, world!",
                  "type": "text",
                },
                {
                  "input": {
                    "value": "value",
                  },
                  "providerExecuted": undefined,
                  "providerOptions": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
              ],
              "role": "assistant",
            },
            {
              "content": [
                {
                  "output": {
                    "type": "text",
                    "value": "value-result",
                  },
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "role": "tool",
            },
          ],
          "runtimeContext": {},
          "sources": [],
          "staticToolCalls": [
            {
              "input": {
                "value": "value",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
          ],
          "staticToolResults": [
            {
              "dynamic": false,
              "input": {
                "value": "value",
              },
              "output": "value-result",
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-result",
            },
          ],
          "stepNumber": 0,
          "steps": [
            DefaultStepResult {
              "callId": "test-telemetry-call-id",
              "content": [
                {
                  "providerMetadata": undefined,
                  "text": "Hello, world!",
                  "type": "text",
                },
                {
                  "input": {
                    "value": "value",
                  },
                  "providerExecuted": undefined,
                  "providerMetadata": undefined,
                  "title": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
                {
                  "dynamic": false,
                  "input": {
                    "value": "value",
                  },
                  "output": "value-result",
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "finishReason": "stop",
              "model": {
                "modelId": "mock-model-id",
                "provider": "mock-provider",
              },
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
                "toolExecutionMs": {
                  "call-1": 0,
                },
              },
              "providerMetadata": {
                "testProvider": {
                  "testKey": "testValue",
                },
              },
              "rawFinishReason": "stop",
              "request": {
                "body": undefined,
                "messages": undefined,
              },
              "response": {
                "headers": {
                  "call": "2",
                },
                "id": "id-0",
                "messages": [
                  {
                    "content": [
                      {
                        "providerOptions": undefined,
                        "text": "Hello, world!",
                        "type": "text",
                      },
                      {
                        "input": {
                          "value": "value",
                        },
                        "providerExecuted": undefined,
                        "providerOptions": undefined,
                        "toolCallId": "call-1",
                        "toolName": "tool1",
                        "type": "tool-call",
                      },
                    ],
                    "role": "assistant",
                  },
                  {
                    "content": [
                      {
                        "output": {
                          "type": "text",
                          "value": "value-result",
                        },
                        "toolCallId": "call-1",
                        "toolName": "tool1",
                        "type": "tool-result",
                      },
                    ],
                    "role": "tool",
                  },
                ],
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "runtimeContext": {},
              "stepNumber": 0,
              "toolsContext": {},
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
              "warnings": [],
            },
          ],
          "text": "Hello, world!",
          "toolCalls": [
            {
              "input": {
                "value": "value",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
          ],
          "toolResults": [
            {
              "dynamic": false,
              "input": {
                "value": "value",
              },
              "output": "value-result",
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-result",
            },
          ],
          "toolsContext": {},
          "totalUsage": {
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
            "totalTokens": 13,
          },
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
            "totalTokens": 13,
          },
          "warnings": [],
        }
      `);
    });

    it('should send sources', async () => {
      let result!: Parameters<
        Required<Parameters<typeof streamText>[0]>['onFinish']
      >[0];

      const resultObject = streamText({
        model: modelWithSources,
        onFinish: async event => {
          result = event as unknown as typeof result;
        },
        ...defaultSettings(),
      });

      await resultObject.consumeStream();

      expect(result).toMatchInlineSnapshot(`
        {
          "callId": "test-telemetry-call-id",
          "content": [
            {
              "id": "123",
              "providerMetadata": {
                "provider": {
                  "custom": "value",
                },
              },
              "sourceType": "url",
              "title": "Example",
              "type": "source",
              "url": "https://example.com",
            },
            {
              "providerMetadata": undefined,
              "text": "Hello!",
              "type": "text",
            },
            {
              "id": "456",
              "providerMetadata": {
                "provider": {
                  "custom": "value2",
                },
              },
              "sourceType": "url",
              "title": "Example 2",
              "type": "source",
              "url": "https://example.com/2",
            },
          ],
          "dynamicToolCalls": [],
          "dynamicToolResults": [],
          "files": [],
          "finalStep": DefaultStepResult {
            "callId": "test-telemetry-call-id",
            "content": [
              {
                "id": "123",
                "providerMetadata": {
                  "provider": {
                    "custom": "value",
                  },
                },
                "sourceType": "url",
                "title": "Example",
                "type": "source",
                "url": "https://example.com",
              },
              {
                "providerMetadata": undefined,
                "text": "Hello!",
                "type": "text",
              },
              {
                "id": "456",
                "providerMetadata": {
                  "provider": {
                    "custom": "value2",
                  },
                },
                "sourceType": "url",
                "title": "Example 2",
                "type": "source",
                "url": "https://example.com/2",
              },
            ],
            "finishReason": "stop",
            "model": {
              "modelId": "mock-model-id",
              "provider": "mock-provider",
            },
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
            "request": {
              "body": undefined,
              "messages": undefined,
            },
            "response": {
              "headers": undefined,
              "id": "id-0",
              "messages": [
                {
                  "content": [
                    {
                      "providerOptions": undefined,
                      "text": "Hello!",
                      "type": "text",
                    },
                  ],
                  "role": "assistant",
                },
              ],
              "modelId": "mock-model-id",
              "timestamp": 1970-01-01T00:00:00.000Z,
            },
            "runtimeContext": {},
            "stepNumber": 0,
            "toolsContext": {},
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
            "warnings": [],
          },
          "finishReason": "stop",
          "model": {
            "modelId": "mock-model-id",
            "provider": "mock-provider",
          },
          "providerMetadata": undefined,
          "rawFinishReason": "stop",
          "reasoning": [],
          "reasoningText": undefined,
          "request": {
            "body": undefined,
            "messages": undefined,
          },
          "response": {
            "headers": undefined,
            "id": "id-0",
            "messages": [
              {
                "content": [
                  {
                    "providerOptions": undefined,
                    "text": "Hello!",
                    "type": "text",
                  },
                ],
                "role": "assistant",
              },
            ],
            "modelId": "mock-model-id",
            "timestamp": 1970-01-01T00:00:00.000Z,
          },
          "responseMessages": [
            {
              "content": [
                {
                  "providerOptions": undefined,
                  "text": "Hello!",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ],
          "runtimeContext": {},
          "sources": [
            {
              "id": "123",
              "providerMetadata": {
                "provider": {
                  "custom": "value",
                },
              },
              "sourceType": "url",
              "title": "Example",
              "type": "source",
              "url": "https://example.com",
            },
            {
              "id": "456",
              "providerMetadata": {
                "provider": {
                  "custom": "value2",
                },
              },
              "sourceType": "url",
              "title": "Example 2",
              "type": "source",
              "url": "https://example.com/2",
            },
          ],
          "staticToolCalls": [],
          "staticToolResults": [],
          "stepNumber": 0,
          "steps": [
            DefaultStepResult {
              "callId": "test-telemetry-call-id",
              "content": [
                {
                  "id": "123",
                  "providerMetadata": {
                    "provider": {
                      "custom": "value",
                    },
                  },
                  "sourceType": "url",
                  "title": "Example",
                  "type": "source",
                  "url": "https://example.com",
                },
                {
                  "providerMetadata": undefined,
                  "text": "Hello!",
                  "type": "text",
                },
                {
                  "id": "456",
                  "providerMetadata": {
                    "provider": {
                      "custom": "value2",
                    },
                  },
                  "sourceType": "url",
                  "title": "Example 2",
                  "type": "source",
                  "url": "https://example.com/2",
                },
              ],
              "finishReason": "stop",
              "model": {
                "modelId": "mock-model-id",
                "provider": "mock-provider",
              },
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
              "request": {
                "body": undefined,
                "messages": undefined,
              },
              "response": {
                "headers": undefined,
                "id": "id-0",
                "messages": [
                  {
                    "content": [
                      {
                        "providerOptions": undefined,
                        "text": "Hello!",
                        "type": "text",
                      },
                    ],
                    "role": "assistant",
                  },
                ],
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "runtimeContext": {},
              "stepNumber": 0,
              "toolsContext": {},
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
              "warnings": [],
            },
          ],
          "text": "Hello!",
          "toolCalls": [],
          "toolResults": [],
          "toolsContext": {},
          "totalUsage": {
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
            "totalTokens": 13,
          },
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
            "totalTokens": 13,
          },
          "warnings": [],
        }
      `);
    });

    it('should send custom parts', async () => {
      let result!: Parameters<
        Required<Parameters<typeof streamText>[0]>['onFinish']
      >[0];

      const resultObject = streamText({
        model: modelWithCustom,
        onFinish: async event => {
          result = event as unknown as typeof result;
        },
        ...defaultSettings(),
      });

      await resultObject.consumeStream();

      expect(result.content).toStrictEqual([
        {
          providerMetadata: undefined,
          text: 'Hello!',
          type: 'text',
        },
        {
          kind: 'openai.compaction',
          providerMetadata: {
            openai: { itemId: 'cmp_123' },
          },
          type: 'custom',
        },
      ]);
    });

    it('should send files', async () => {
      let result!: Parameters<
        Required<Parameters<typeof streamText>[0]>['onFinish']
      >[0];

      const resultObject = streamText({
        model: modelWithFiles,
        onFinish: async event => {
          result = event as unknown as typeof result;
        },
        ...defaultSettings(),
      });

      await resultObject.consumeStream();

      expect(result).toMatchInlineSnapshot(`
        {
          "callId": "test-telemetry-call-id",
          "content": [
            {
              "file": DefaultGeneratedFileWithType {
                "base64Data": "Hello World",
                "mediaType": "text/plain",
                "type": "file",
                "uint8ArrayData": undefined,
              },
              "type": "file",
            },
            {
              "providerMetadata": undefined,
              "text": "Hello!",
              "type": "text",
            },
            {
              "file": DefaultGeneratedFileWithType {
                "base64Data": "QkFVRw==",
                "mediaType": "image/jpeg",
                "type": "file",
                "uint8ArrayData": undefined,
              },
              "type": "file",
            },
          ],
          "dynamicToolCalls": [],
          "dynamicToolResults": [],
          "files": [
            DefaultGeneratedFileWithType {
              "base64Data": "Hello World",
              "mediaType": "text/plain",
              "type": "file",
              "uint8ArrayData": undefined,
            },
            DefaultGeneratedFileWithType {
              "base64Data": "QkFVRw==",
              "mediaType": "image/jpeg",
              "type": "file",
              "uint8ArrayData": undefined,
            },
          ],
          "finalStep": DefaultStepResult {
            "callId": "test-telemetry-call-id",
            "content": [
              {
                "file": DefaultGeneratedFileWithType {
                  "base64Data": "Hello World",
                  "mediaType": "text/plain",
                  "type": "file",
                  "uint8ArrayData": undefined,
                },
                "type": "file",
              },
              {
                "providerMetadata": undefined,
                "text": "Hello!",
                "type": "text",
              },
              {
                "file": DefaultGeneratedFileWithType {
                  "base64Data": "QkFVRw==",
                  "mediaType": "image/jpeg",
                  "type": "file",
                  "uint8ArrayData": undefined,
                },
                "type": "file",
              },
            ],
            "finishReason": "stop",
            "model": {
              "modelId": "mock-model-id",
              "provider": "mock-provider",
            },
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
            "request": {
              "body": undefined,
              "messages": undefined,
            },
            "response": {
              "headers": undefined,
              "id": "id-0",
              "messages": [
                {
                  "content": [
                    {
                      "data": "Hello World",
                      "mediaType": "text/plain",
                      "providerOptions": undefined,
                      "type": "file",
                    },
                    {
                      "providerOptions": undefined,
                      "text": "Hello!",
                      "type": "text",
                    },
                    {
                      "data": "QkFVRw==",
                      "mediaType": "image/jpeg",
                      "providerOptions": undefined,
                      "type": "file",
                    },
                  ],
                  "role": "assistant",
                },
              ],
              "modelId": "mock-model-id",
              "timestamp": 1970-01-01T00:00:00.000Z,
            },
            "runtimeContext": {},
            "stepNumber": 0,
            "toolsContext": {},
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
            "warnings": [],
          },
          "finishReason": "stop",
          "model": {
            "modelId": "mock-model-id",
            "provider": "mock-provider",
          },
          "providerMetadata": undefined,
          "rawFinishReason": "stop",
          "reasoning": [],
          "reasoningText": undefined,
          "request": {
            "body": undefined,
            "messages": undefined,
          },
          "response": {
            "headers": undefined,
            "id": "id-0",
            "messages": [
              {
                "content": [
                  {
                    "data": "Hello World",
                    "mediaType": "text/plain",
                    "providerOptions": undefined,
                    "type": "file",
                  },
                  {
                    "providerOptions": undefined,
                    "text": "Hello!",
                    "type": "text",
                  },
                  {
                    "data": "QkFVRw==",
                    "mediaType": "image/jpeg",
                    "providerOptions": undefined,
                    "type": "file",
                  },
                ],
                "role": "assistant",
              },
            ],
            "modelId": "mock-model-id",
            "timestamp": 1970-01-01T00:00:00.000Z,
          },
          "responseMessages": [
            {
              "content": [
                {
                  "data": "Hello World",
                  "mediaType": "text/plain",
                  "providerOptions": undefined,
                  "type": "file",
                },
                {
                  "providerOptions": undefined,
                  "text": "Hello!",
                  "type": "text",
                },
                {
                  "data": "QkFVRw==",
                  "mediaType": "image/jpeg",
                  "providerOptions": undefined,
                  "type": "file",
                },
              ],
              "role": "assistant",
            },
          ],
          "runtimeContext": {},
          "sources": [],
          "staticToolCalls": [],
          "staticToolResults": [],
          "stepNumber": 0,
          "steps": [
            DefaultStepResult {
              "callId": "test-telemetry-call-id",
              "content": [
                {
                  "file": DefaultGeneratedFileWithType {
                    "base64Data": "Hello World",
                    "mediaType": "text/plain",
                    "type": "file",
                    "uint8ArrayData": undefined,
                  },
                  "type": "file",
                },
                {
                  "providerMetadata": undefined,
                  "text": "Hello!",
                  "type": "text",
                },
                {
                  "file": DefaultGeneratedFileWithType {
                    "base64Data": "QkFVRw==",
                    "mediaType": "image/jpeg",
                    "type": "file",
                    "uint8ArrayData": undefined,
                  },
                  "type": "file",
                },
              ],
              "finishReason": "stop",
              "model": {
                "modelId": "mock-model-id",
                "provider": "mock-provider",
              },
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
              "request": {
                "body": undefined,
                "messages": undefined,
              },
              "response": {
                "headers": undefined,
                "id": "id-0",
                "messages": [
                  {
                    "content": [
                      {
                        "data": "Hello World",
                        "mediaType": "text/plain",
                        "providerOptions": undefined,
                        "type": "file",
                      },
                      {
                        "providerOptions": undefined,
                        "text": "Hello!",
                        "type": "text",
                      },
                      {
                        "data": "QkFVRw==",
                        "mediaType": "image/jpeg",
                        "providerOptions": undefined,
                        "type": "file",
                      },
                    ],
                    "role": "assistant",
                  },
                ],
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "runtimeContext": {},
              "stepNumber": 0,
              "toolsContext": {},
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
              "warnings": [],
            },
          ],
          "text": "Hello!",
          "toolCalls": [],
          "toolResults": [],
          "toolsContext": {},
          "totalUsage": {
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
            "totalTokens": 13,
          },
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
            "totalTokens": 13,
          },
          "warnings": [],
        }
      `);
    });

    it('should not prevent error from being forwarded', async () => {
      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            throw new Error('test error');
          },
        }),
        prompt: 'test-input',
        onFinish() {}, // just defined; do nothing
        onError: () => {},
      });

      expect(await convertAsyncIterableToArray(result.stream)).toStrictEqual([
        {
          type: 'start',
        },
        {
          type: 'error',
          error: new Error('test error'),
        },
      ]);
    });
  });

  describe('result.responseMessages', () => {
    it('should contain assistant response message when there are no tool calls', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello, ' },
            { type: 'text-delta', id: '1', delta: 'world!' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        prompt: 'test-input',
      });

      expect(await result.responseMessages).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "providerOptions": undefined,
                "text": "Hello, world!",
                "type": "text",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should contain assistant response message and tool message when there are tool calls with results', async () => {
      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello, ' },
            { type: 'text-delta', id: '1', delta: 'world!' },
            { type: 'text-end', id: '1' },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: `{ "value": "value" }`,
            },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'result1',
          },
        },
        prompt: 'test-input',
      });

      expect(await result.responseMessages).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "providerOptions": undefined,
                "text": "Hello, world!",
                "type": "text",
              },
              {
                "input": {
                  "value": "value",
                },
                "providerExecuted": undefined,
                "providerOptions": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "output": {
                  "type": "text",
                  "value": "result1",
                },
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-result",
              },
            ],
            "role": "tool",
          },
        ]
      `);
    });

    it('should support onFinish as a deprecated alias', async () => {
      const calls: string[] = [];

      const resultObject = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        onFinish: async () => {
          calls.push('onFinish');
        },
        ...defaultSettings(),
      });

      await resultObject.consumeStream();

      expect(calls).toEqual(['onFinish']);
    });

    it('should prefer onEnd over onFinish', async () => {
      const calls: string[] = [];

      const resultObject = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        onEnd: async () => {
          calls.push('onEnd');
        },
        onFinish: async () => {
          calls.push('onFinish');
        },
        ...defaultSettings(),
      });

      await resultObject.consumeStream();

      expect(calls).toEqual(['onEnd']);
    });
  });

  describe('options.stopWhen', () => {
    let result: StreamTextResult<any, any, any>;
    let onFinishResult: Parameters<GenerateTextOnEndCallback<any, any>>[0];
    let onStepFinishResults: StepResult<any, any>[];
    let stepInputs: Array<any>;

    beforeEach(() => {
      result = undefined as any;
      onFinishResult = undefined as any;
      onStepFinishResults = [];
      stepInputs = [];
    });

    describe('2 steps: initial, tool-result', () => {
      beforeEach(async () => {
        let responseCount = 0;
        result = streamText({
          model: new MockLanguageModelV4({
            doStream: async ({ prompt, tools, toolChoice }) => {
              stepInputs.push({ prompt, tools, toolChoice });

              switch (responseCount++) {
                case 0: {
                  return {
                    stream: convertArrayToReadableStream([
                      {
                        type: 'response-metadata',
                        id: 'id-0',
                        modelId: 'mock-model-id',
                        timestamp: new Date(0),
                      },
                      { type: 'reasoning-start', id: '0' },
                      { type: 'reasoning-delta', id: '0', delta: 'thinking' },
                      { type: 'reasoning-end', id: '0' },
                      {
                        type: 'tool-call',
                        id: 'call-1',
                        toolCallId: 'call-1',
                        toolName: 'tool1',
                        input: `{ "value": "value" }`,
                      },
                      {
                        type: 'finish',
                        finishReason: { unified: 'tool-calls', raw: undefined },
                        usage: testUsage,
                      },
                    ]),
                    response: { headers: { call: '1' } },
                  };
                }
                case 1: {
                  return {
                    stream: convertArrayToReadableStream([
                      {
                        type: 'response-metadata',
                        id: 'id-1',
                        modelId: 'mock-model-id',
                        timestamp: new Date(1000),
                      },
                      { type: 'text-start', id: '1' },
                      { type: 'text-delta', id: '1', delta: 'Hello, ' },
                      { type: 'text-delta', id: '1', delta: `world!` },
                      { type: 'text-end', id: '1' },
                      {
                        type: 'finish',
                        finishReason: { unified: 'stop', raw: 'stop' },
                        usage: testUsage2,
                      },
                    ]),
                    response: { headers: { call: '2' } },
                  };
                }
                default:
                  throw new Error(
                    `Unexpected response count: ${responseCount}`,
                  );
              }
            },
          }),
          tools: {
            tool1: {
              inputSchema: z.object({ value: z.string() }),
              execute: async () => 'result1',
            },
          },
          prompt: 'test-input',
          onFinish: async event => {
            onFinishResult = event as unknown as typeof onFinishResult;
          },
          onStepFinish: async event => {
            onStepFinishResults.push(event);
          },
          stopWhen: isStepCount(3),
          _internal: {
            now: mockValues(0, 0, 100, 500, 600, 1000),
            generateId: mockId({ prefix: 'id' }),
            generateCallId: () => 'test-telemetry-call-id',
          },
        });
      });

      it('should contain correct step inputs', async () => {
        await result.consumeStream();

        expect(stepInputs).toMatchInlineSnapshot(`
          [
            {
              "prompt": [
                {
                  "content": [
                    {
                      "text": "test-input",
                      "type": "text",
                    },
                  ],
                  "providerOptions": undefined,
                  "role": "user",
                },
              ],
              "toolChoice": {
                "type": "auto",
              },
              "tools": [
                {
                  "inputSchema": {
                    "$schema": "http://json-schema.org/draft-07/schema#",
                    "additionalProperties": false,
                    "properties": {
                      "value": {
                        "type": "string",
                      },
                    },
                    "required": [
                      "value",
                    ],
                    "type": "object",
                  },
                  "name": "tool1",
                  "type": "function",
                },
              ],
            },
            {
              "prompt": [
                {
                  "content": [
                    {
                      "text": "test-input",
                      "type": "text",
                    },
                  ],
                  "providerOptions": undefined,
                  "role": "user",
                },
                {
                  "content": [
                    {
                      "providerOptions": undefined,
                      "text": "thinking",
                      "type": "reasoning",
                    },
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "providerOptions": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                  ],
                  "providerOptions": undefined,
                  "role": "assistant",
                },
                {
                  "content": [
                    {
                      "output": {
                        "type": "text",
                        "value": "result1",
                      },
                      "providerOptions": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "providerOptions": undefined,
                  "role": "tool",
                },
              ],
              "toolChoice": {
                "type": "auto",
              },
              "tools": [
                {
                  "inputSchema": {
                    "$schema": "http://json-schema.org/draft-07/schema#",
                    "additionalProperties": false,
                    "properties": {
                      "value": {
                        "type": "string",
                      },
                    },
                    "required": [
                      "value",
                    ],
                    "type": "object",
                  },
                  "name": "tool1",
                  "type": "function",
                },
              ],
            },
          ]
        `);
      });

      it('should contain assistant response message and tool message from all steps', async () => {
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
                "type": "reasoning-start",
              },
              {
                "id": "0",
                "providerMetadata": undefined,
                "text": "thinking",
                "type": "reasoning-delta",
              },
              {
                "id": "0",
                "type": "reasoning-end",
              },
              {
                "input": {
                  "value": "value",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
              {
                "dynamic": false,
                "input": {
                  "value": "value",
                },
                "output": "result1",
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-result",
              },
              {
                "finishReason": "tool-calls",
                "performance": {
                  "effectiveOutputTokensPerSecond": 16.666666666666668,
                  "effectiveTotalTokensPerSecond": 21.666666666666668,
                  "inputTokensPerSecond": 30,
                  "outputTokensPerSecond": 20,
                  "responseTimeMs": 600,
                  "stepTimeMs": 1000,
                  "timeBetweenOutputChunksMs": {
                    "avg": 400,
                    "max": 400,
                    "median": 400,
                    "min": 400,
                    "p10": 400,
                    "p90": 400,
                  },
                  "timeToFirstOutputMs": 100,
                  "toolExecutionMs": {
                    "call-1": 0,
                  },
                },
                "providerMetadata": undefined,
                "rawFinishReason": undefined,
                "response": {
                  "headers": {
                    "call": "1",
                  },
                  "id": "id-0",
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "type": "finish-step",
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
                "request": {
                  "body": undefined,
                  "messages": undefined,
                },
                "type": "start-step",
                "warnings": [],
              },
              {
                "id": "1",
                "type": "text-start",
              },
              {
                "id": "1",
                "providerMetadata": undefined,
                "text": "Hello, ",
                "type": "text-delta",
              },
              {
                "id": "1",
                "providerMetadata": undefined,
                "text": "world!",
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
                  "headers": {
                    "call": "2",
                  },
                  "id": "id-1",
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:01.000Z,
                },
                "type": "finish-step",
                "usage": {
                  "inputTokenDetails": {
                    "cacheReadTokens": 0,
                    "cacheWriteTokens": 0,
                    "noCacheTokens": 3,
                  },
                  "inputTokens": 3,
                  "outputTokenDetails": {
                    "reasoningTokens": 10,
                    "textTokens": 10,
                  },
                  "outputTokens": 10,
                  "raw": undefined,
                  "totalTokens": 13,
                },
              },
              {
                "finishReason": "stop",
                "rawFinishReason": "stop",
                "totalUsage": {
                  "inputTokenDetails": {
                    "cacheReadTokens": 0,
                    "cacheWriteTokens": 0,
                    "noCacheTokens": 6,
                  },
                  "inputTokens": 6,
                  "outputTokenDetails": {
                    "reasoningTokens": 10,
                    "textTokens": 20,
                  },
                  "outputTokens": 20,
                  "totalTokens": 26,
                },
                "type": "finish",
              },
            ]
          `);
      });

      describe('callbacks', () => {
        beforeEach(async () => {
          await result.consumeStream();
        });

        it('onFinish should send correct information', async () => {
          expect(onFinishResult).toMatchInlineSnapshot(`
            {
              "callId": "test-telemetry-call-id",
              "content": [
                {
                  "providerMetadata": undefined,
                  "text": "thinking",
                  "type": "reasoning",
                },
                {
                  "input": {
                    "value": "value",
                  },
                  "providerExecuted": undefined,
                  "providerMetadata": undefined,
                  "title": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
                {
                  "dynamic": false,
                  "input": {
                    "value": "value",
                  },
                  "output": "result1",
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
                {
                  "providerMetadata": undefined,
                  "text": "Hello, world!",
                  "type": "text",
                },
              ],
              "dynamicToolCalls": [],
              "dynamicToolResults": [],
              "files": [],
              "finalStep": DefaultStepResult {
                "callId": "test-telemetry-call-id",
                "content": [
                  {
                    "providerMetadata": undefined,
                    "text": "Hello, world!",
                    "type": "text",
                  },
                ],
                "finishReason": "stop",
                "model": {
                  "modelId": "mock-model-id",
                  "provider": "mock-provider",
                },
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
                "request": {
                  "body": undefined,
                  "messages": undefined,
                },
                "response": {
                  "headers": {
                    "call": "2",
                  },
                  "id": "id-1",
                  "messages": [
                    {
                      "content": [
                        {
                          "providerOptions": undefined,
                          "text": "Hello, world!",
                          "type": "text",
                        },
                      ],
                      "role": "assistant",
                    },
                  ],
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:01.000Z,
                },
                "runtimeContext": {},
                "stepNumber": 1,
                "toolsContext": {},
                "usage": {
                  "inputTokenDetails": {
                    "cacheReadTokens": 0,
                    "cacheWriteTokens": 0,
                    "noCacheTokens": 3,
                  },
                  "inputTokens": 3,
                  "outputTokenDetails": {
                    "reasoningTokens": 10,
                    "textTokens": 10,
                  },
                  "outputTokens": 10,
                  "raw": undefined,
                  "totalTokens": 13,
                },
                "warnings": [],
              },
              "finishReason": "stop",
              "model": {
                "modelId": "mock-model-id",
                "provider": "mock-provider",
              },
              "providerMetadata": undefined,
              "rawFinishReason": "stop",
              "reasoning": [],
              "reasoningText": undefined,
              "request": {
                "body": undefined,
                "messages": undefined,
              },
              "response": {
                "headers": {
                  "call": "2",
                },
                "id": "id-1",
                "messages": [
                  {
                    "content": [
                      {
                        "providerOptions": undefined,
                        "text": "Hello, world!",
                        "type": "text",
                      },
                    ],
                    "role": "assistant",
                  },
                ],
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:01.000Z,
              },
              "responseMessages": [
                {
                  "content": [
                    {
                      "providerOptions": undefined,
                      "text": "thinking",
                      "type": "reasoning",
                    },
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "providerOptions": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                  ],
                  "role": "assistant",
                },
                {
                  "content": [
                    {
                      "output": {
                        "type": "text",
                        "value": "result1",
                      },
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "role": "tool",
                },
                {
                  "content": [
                    {
                      "providerOptions": undefined,
                      "text": "Hello, world!",
                      "type": "text",
                    },
                  ],
                  "role": "assistant",
                },
              ],
              "runtimeContext": {},
              "sources": [],
              "staticToolCalls": [
                {
                  "input": {
                    "value": "value",
                  },
                  "providerExecuted": undefined,
                  "providerMetadata": undefined,
                  "title": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
              ],
              "staticToolResults": [
                {
                  "dynamic": false,
                  "input": {
                    "value": "value",
                  },
                  "output": "result1",
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "stepNumber": 1,
              "steps": [
                DefaultStepResult {
                  "callId": "test-telemetry-call-id",
                  "content": [
                    {
                      "providerMetadata": undefined,
                      "text": "thinking",
                      "type": "reasoning",
                    },
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "providerMetadata": undefined,
                      "title": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                    {
                      "dynamic": false,
                      "input": {
                        "value": "value",
                      },
                      "output": "result1",
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "finishReason": "tool-calls",
                  "model": {
                    "modelId": "mock-model-id",
                    "provider": "mock-provider",
                  },
                  "performance": {
                    "effectiveOutputTokensPerSecond": 16.666666666666668,
                    "effectiveTotalTokensPerSecond": 21.666666666666668,
                    "inputTokensPerSecond": 30,
                    "outputTokensPerSecond": 20,
                    "responseTimeMs": 600,
                    "stepTimeMs": 1000,
                    "timeBetweenOutputChunksMs": {
                      "avg": 400,
                      "max": 400,
                      "median": 400,
                      "min": 400,
                      "p10": 400,
                      "p90": 400,
                    },
                    "timeToFirstOutputMs": 100,
                    "toolExecutionMs": {
                      "call-1": 0,
                    },
                  },
                  "providerMetadata": undefined,
                  "rawFinishReason": undefined,
                  "request": {
                    "body": undefined,
                    "messages": undefined,
                  },
                  "response": {
                    "headers": {
                      "call": "1",
                    },
                    "id": "id-0",
                    "messages": [
                      {
                        "content": [
                          {
                            "providerOptions": undefined,
                            "text": "thinking",
                            "type": "reasoning",
                          },
                          {
                            "input": {
                              "value": "value",
                            },
                            "providerExecuted": undefined,
                            "providerOptions": undefined,
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-call",
                          },
                        ],
                        "role": "assistant",
                      },
                      {
                        "content": [
                          {
                            "output": {
                              "type": "text",
                              "value": "result1",
                            },
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-result",
                          },
                        ],
                        "role": "tool",
                      },
                    ],
                    "modelId": "mock-model-id",
                    "timestamp": 1970-01-01T00:00:00.000Z,
                  },
                  "runtimeContext": {},
                  "stepNumber": 0,
                  "toolsContext": {},
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
                  "warnings": [],
                },
                DefaultStepResult {
                  "callId": "test-telemetry-call-id",
                  "content": [
                    {
                      "providerMetadata": undefined,
                      "text": "Hello, world!",
                      "type": "text",
                    },
                  ],
                  "finishReason": "stop",
                  "model": {
                    "modelId": "mock-model-id",
                    "provider": "mock-provider",
                  },
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
                  "request": {
                    "body": undefined,
                    "messages": undefined,
                  },
                  "response": {
                    "headers": {
                      "call": "2",
                    },
                    "id": "id-1",
                    "messages": [
                      {
                        "content": [
                          {
                            "providerOptions": undefined,
                            "text": "Hello, world!",
                            "type": "text",
                          },
                        ],
                        "role": "assistant",
                      },
                    ],
                    "modelId": "mock-model-id",
                    "timestamp": 1970-01-01T00:00:01.000Z,
                  },
                  "runtimeContext": {},
                  "stepNumber": 1,
                  "toolsContext": {},
                  "usage": {
                    "inputTokenDetails": {
                      "cacheReadTokens": 0,
                      "cacheWriteTokens": 0,
                      "noCacheTokens": 3,
                    },
                    "inputTokens": 3,
                    "outputTokenDetails": {
                      "reasoningTokens": 10,
                      "textTokens": 10,
                    },
                    "outputTokens": 10,
                    "raw": undefined,
                    "totalTokens": 13,
                  },
                  "warnings": [],
                },
              ],
              "text": "Hello, world!",
              "toolCalls": [
                {
                  "input": {
                    "value": "value",
                  },
                  "providerExecuted": undefined,
                  "providerMetadata": undefined,
                  "title": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
              ],
              "toolResults": [
                {
                  "dynamic": false,
                  "input": {
                    "value": "value",
                  },
                  "output": "result1",
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "toolsContext": {},
              "totalUsage": {
                "inputTokenDetails": {
                  "cacheReadTokens": 0,
                  "cacheWriteTokens": 0,
                  "noCacheTokens": 6,
                },
                "inputTokens": 6,
                "outputTokenDetails": {
                  "reasoningTokens": 10,
                  "textTokens": 20,
                },
                "outputTokens": 20,
                "totalTokens": 26,
              },
              "usage": {
                "inputTokenDetails": {
                  "cacheReadTokens": 0,
                  "cacheWriteTokens": 0,
                  "noCacheTokens": 6,
                },
                "inputTokens": 6,
                "outputTokenDetails": {
                  "reasoningTokens": 10,
                  "textTokens": 20,
                },
                "outputTokens": 20,
                "totalTokens": 26,
              },
              "warnings": [],
            }
          `);
        });

        it('onStepFinish should send correct information', async () => {
          expect(onStepFinishResults).toMatchInlineSnapshot(`
            [
              DefaultStepResult {
                "callId": "test-telemetry-call-id",
                "content": [
                  {
                    "providerMetadata": undefined,
                    "text": "thinking",
                    "type": "reasoning",
                  },
                  {
                    "input": {
                      "value": "value",
                    },
                    "providerExecuted": undefined,
                    "providerMetadata": undefined,
                    "title": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                  {
                    "dynamic": false,
                    "input": {
                      "value": "value",
                    },
                    "output": "result1",
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "finishReason": "tool-calls",
                "model": {
                  "modelId": "mock-model-id",
                  "provider": "mock-provider",
                },
                "performance": {
                  "effectiveOutputTokensPerSecond": 16.666666666666668,
                  "effectiveTotalTokensPerSecond": 21.666666666666668,
                  "inputTokensPerSecond": 30,
                  "outputTokensPerSecond": 20,
                  "responseTimeMs": 600,
                  "stepTimeMs": 1000,
                  "timeBetweenOutputChunksMs": {
                    "avg": 400,
                    "max": 400,
                    "median": 400,
                    "min": 400,
                    "p10": 400,
                    "p90": 400,
                  },
                  "timeToFirstOutputMs": 100,
                  "toolExecutionMs": {
                    "call-1": 0,
                  },
                },
                "providerMetadata": undefined,
                "rawFinishReason": undefined,
                "request": {
                  "body": undefined,
                  "messages": undefined,
                },
                "response": {
                  "headers": {
                    "call": "1",
                  },
                  "id": "id-0",
                  "messages": [
                    {
                      "content": [
                        {
                          "providerOptions": undefined,
                          "text": "thinking",
                          "type": "reasoning",
                        },
                        {
                          "input": {
                            "value": "value",
                          },
                          "providerExecuted": undefined,
                          "providerOptions": undefined,
                          "toolCallId": "call-1",
                          "toolName": "tool1",
                          "type": "tool-call",
                        },
                      ],
                      "role": "assistant",
                    },
                    {
                      "content": [
                        {
                          "output": {
                            "type": "text",
                            "value": "result1",
                          },
                          "toolCallId": "call-1",
                          "toolName": "tool1",
                          "type": "tool-result",
                        },
                      ],
                      "role": "tool",
                    },
                  ],
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "runtimeContext": {},
                "stepNumber": 0,
                "toolsContext": {},
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
                "warnings": [],
              },
              DefaultStepResult {
                "callId": "test-telemetry-call-id",
                "content": [
                  {
                    "providerMetadata": undefined,
                    "text": "Hello, world!",
                    "type": "text",
                  },
                ],
                "finishReason": "stop",
                "model": {
                  "modelId": "mock-model-id",
                  "provider": "mock-provider",
                },
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
                "request": {
                  "body": undefined,
                  "messages": undefined,
                },
                "response": {
                  "headers": {
                    "call": "2",
                  },
                  "id": "id-1",
                  "messages": [
                    {
                      "content": [
                        {
                          "providerOptions": undefined,
                          "text": "Hello, world!",
                          "type": "text",
                        },
                      ],
                      "role": "assistant",
                    },
                  ],
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:01.000Z,
                },
                "runtimeContext": {},
                "stepNumber": 1,
                "toolsContext": {},
                "usage": {
                  "inputTokenDetails": {
                    "cacheReadTokens": 0,
                    "cacheWriteTokens": 0,
                    "noCacheTokens": 3,
                  },
                  "inputTokens": 3,
                  "outputTokenDetails": {
                    "reasoningTokens": 10,
                    "textTokens": 10,
                  },
                  "outputTokens": 10,
                  "raw": undefined,
                  "totalTokens": 13,
                },
                "warnings": [],
              },
            ]
          `);
        });
      });

      describe('value promises', () => {
        beforeEach(async () => {
          await result.consumeStream();
        });

        it('result.totalUsage should contain total token usage', async () => {
          expect(await result.totalUsage).toMatchInlineSnapshot(`
            {
              "inputTokenDetails": {
                "cacheReadTokens": 0,
                "cacheWriteTokens": 0,
                "noCacheTokens": 6,
              },
              "inputTokens": 6,
              "outputTokenDetails": {
                "reasoningTokens": 10,
                "textTokens": 20,
              },
              "outputTokens": 20,
              "totalTokens": 26,
            }
          `);
        });

        it('result.usage should contain total token usage', async () => {
          expect(await result.usage).toMatchInlineSnapshot(`
            {
              "inputTokenDetails": {
                "cacheReadTokens": 0,
                "cacheWriteTokens": 0,
                "noCacheTokens": 6,
              },
              "inputTokens": 6,
              "outputTokenDetails": {
                "reasoningTokens": 10,
                "textTokens": 20,
              },
              "outputTokens": 20,
              "totalTokens": 26,
            }
          `);
        });

        it('result.finalStep.usage should contain token usage from final step', async () => {
          expect((await result.finalStep).usage).toMatchInlineSnapshot(`
            {
              "inputTokenDetails": {
                "cacheReadTokens": 0,
                "cacheWriteTokens": 0,
                "noCacheTokens": 3,
              },
              "inputTokens": 3,
              "outputTokenDetails": {
                "reasoningTokens": 10,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "raw": undefined,
              "totalTokens": 13,
            }
          `);
        });

        it('onFinishResult.usage should sum token usage and finalStep should contain final step usage', async () => {
          expect(onFinishResult.usage).toEqual(await result.usage);
          expect(onFinishResult.usage).toEqual(await result.totalUsage);
          expect(onFinishResult.totalUsage).toEqual(await result.totalUsage);
          expect(onFinishResult.finalStep).toBe(onFinishResult.steps.at(-1));
          expect(onFinishResult.finalStep.usage).toEqual(
            (await result.finalStep).usage,
          );
        });

        it('onFinishResult should expose deprecated AI SDK 6 final-step properties', async () => {
          const finalStep = await result.finalStep;

          expect(onFinishResult.reasoning).toEqual(finalStep.reasoning);
          expect(onFinishResult.reasoningText).toEqual(finalStep.reasoningText);
          expect(onFinishResult.request).toEqual(finalStep.request);
          expect(onFinishResult.response).toEqual(finalStep.response);
          expect(onFinishResult.providerMetadata).toEqual(
            finalStep.providerMetadata,
          );
        });

        it('result.finishReason should contain finish reason from final step', async () => {
          assert.strictEqual(await result.finishReason, 'stop');
        });

        it('result.text should contain text from final step', async () => {
          assert.strictEqual(await result.text, 'Hello, world!');
        });

        it('result.steps should contain all steps', async () => {
          expect(await result.steps).toMatchInlineSnapshot(`
            [
              DefaultStepResult {
                "callId": "test-telemetry-call-id",
                "content": [
                  {
                    "providerMetadata": undefined,
                    "text": "thinking",
                    "type": "reasoning",
                  },
                  {
                    "input": {
                      "value": "value",
                    },
                    "providerExecuted": undefined,
                    "providerMetadata": undefined,
                    "title": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                  {
                    "dynamic": false,
                    "input": {
                      "value": "value",
                    },
                    "output": "result1",
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "finishReason": "tool-calls",
                "model": {
                  "modelId": "mock-model-id",
                  "provider": "mock-provider",
                },
                "performance": {
                  "effectiveOutputTokensPerSecond": 16.666666666666668,
                  "effectiveTotalTokensPerSecond": 21.666666666666668,
                  "inputTokensPerSecond": 30,
                  "outputTokensPerSecond": 20,
                  "responseTimeMs": 600,
                  "stepTimeMs": 1000,
                  "timeBetweenOutputChunksMs": {
                    "avg": 400,
                    "max": 400,
                    "median": 400,
                    "min": 400,
                    "p10": 400,
                    "p90": 400,
                  },
                  "timeToFirstOutputMs": 100,
                  "toolExecutionMs": {
                    "call-1": 0,
                  },
                },
                "providerMetadata": undefined,
                "rawFinishReason": undefined,
                "request": {
                  "body": undefined,
                  "messages": undefined,
                },
                "response": {
                  "headers": {
                    "call": "1",
                  },
                  "id": "id-0",
                  "messages": [
                    {
                      "content": [
                        {
                          "providerOptions": undefined,
                          "text": "thinking",
                          "type": "reasoning",
                        },
                        {
                          "input": {
                            "value": "value",
                          },
                          "providerExecuted": undefined,
                          "providerOptions": undefined,
                          "toolCallId": "call-1",
                          "toolName": "tool1",
                          "type": "tool-call",
                        },
                      ],
                      "role": "assistant",
                    },
                    {
                      "content": [
                        {
                          "output": {
                            "type": "text",
                            "value": "result1",
                          },
                          "toolCallId": "call-1",
                          "toolName": "tool1",
                          "type": "tool-result",
                        },
                      ],
                      "role": "tool",
                    },
                  ],
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "runtimeContext": {},
                "stepNumber": 0,
                "toolsContext": {},
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
                "warnings": [],
              },
              DefaultStepResult {
                "callId": "test-telemetry-call-id",
                "content": [
                  {
                    "providerMetadata": undefined,
                    "text": "Hello, world!",
                    "type": "text",
                  },
                ],
                "finishReason": "stop",
                "model": {
                  "modelId": "mock-model-id",
                  "provider": "mock-provider",
                },
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
                "request": {
                  "body": undefined,
                  "messages": undefined,
                },
                "response": {
                  "headers": {
                    "call": "2",
                  },
                  "id": "id-1",
                  "messages": [
                    {
                      "content": [
                        {
                          "providerOptions": undefined,
                          "text": "Hello, world!",
                          "type": "text",
                        },
                      ],
                      "role": "assistant",
                    },
                  ],
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:01.000Z,
                },
                "runtimeContext": {},
                "stepNumber": 1,
                "toolsContext": {},
                "usage": {
                  "inputTokenDetails": {
                    "cacheReadTokens": 0,
                    "cacheWriteTokens": 0,
                    "noCacheTokens": 3,
                  },
                  "inputTokens": 3,
                  "outputTokenDetails": {
                    "reasoningTokens": 10,
                    "textTokens": 10,
                  },
                  "outputTokens": 10,
                  "raw": undefined,
                  "totalTokens": 13,
                },
                "warnings": [],
              },
            ]
          `);
        });

        it('result.responseMessages should contain response messages from all steps', async () => {
          expect(await result.responseMessages).toMatchInlineSnapshot(`
            [
              {
                "content": [
                  {
                    "providerOptions": undefined,
                    "text": "thinking",
                    "type": "reasoning",
                  },
                  {
                    "input": {
                      "value": "value",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                ],
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "text",
                      "value": "result1",
                    },
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "role": "tool",
              },
              {
                "content": [
                  {
                    "providerOptions": undefined,
                    "text": "Hello, world!",
                    "type": "text",
                  },
                ],
                "role": "assistant",
              },
            ]
          `);
        });
      });

      it('should have correct ui message stream', async () => {
        expect(await convertReadableStreamToArray(result.toUIMessageStream()))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "start",
              },
              {
                "type": "start-step",
              },
              {
                "id": "0",
                "type": "reasoning-start",
              },
              {
                "delta": "thinking",
                "id": "0",
                "type": "reasoning-delta",
              },
              {
                "id": "0",
                "type": "reasoning-end",
              },
              {
                "input": {
                  "value": "value",
                },
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-input-available",
              },
              {
                "output": "result1",
                "toolCallId": "call-1",
                "type": "tool-output-available",
              },
              {
                "type": "finish-step",
              },
              {
                "type": "start-step",
              },
              {
                "id": "1",
                "type": "text-start",
              },
              {
                "delta": "Hello, ",
                "id": "1",
                "type": "text-delta",
              },
              {
                "delta": "world!",
                "id": "1",
                "type": "text-delta",
              },
              {
                "id": "1",
                "type": "text-end",
              },
              {
                "type": "finish-step",
              },
              {
                "finishReason": "stop",
                "type": "finish",
              },
            ]
          `);
      });
    });

    describe('2 steps: initial, tool-result with prepareStep', () => {
      let doStreamCalls: Array<LanguageModelV4CallOptions>;
      let prepareStepCalls: Array<{
        modelId: string;
        stepNumber: number;
        steps: Array<StepResult<any, any>>;
        messages: Array<ModelMessage>;
        runtimeContext: unknown;
      }>;

      beforeEach(async () => {
        doStreamCalls = [];
        prepareStepCalls = [];

        result = streamText({
          model: new MockLanguageModelV4({
            doStream: async options => {
              doStreamCalls.push(options);
              switch (doStreamCalls.length) {
                case 1:
                  return {
                    stream: convertArrayToReadableStream([
                      {
                        type: 'response-metadata',
                        id: 'id-0',
                        modelId: 'mock-model-id',
                        timestamp: new Date(0),
                      },
                      {
                        type: 'tool-call',
                        toolCallId: 'call-1',
                        toolName: 'tool1',
                        input: `{ "value": "value" }`,
                      },
                      {
                        type: 'finish',
                        finishReason: { unified: 'tool-calls', raw: undefined },
                        usage: testUsage,
                      },
                    ]),
                    response: { headers: { call: '1' } },
                  };
                case 2:
                  return {
                    stream: convertArrayToReadableStream([
                      {
                        type: 'response-metadata',
                        id: 'id-1',
                        modelId: 'mock-model-id',
                        timestamp: new Date(1000),
                      },
                      { type: 'text-start', id: '2' },
                      { type: 'text-delta', id: '2', delta: 'Hello, ' },
                      { type: 'text-delta', id: '2', delta: `world!` },
                      { type: 'text-end', id: '2' },
                      {
                        type: 'finish',
                        finishReason: { unified: 'stop', raw: 'stop' },
                        usage: testUsage2,
                      },
                    ]),
                    response: { headers: { call: '2' } },
                  };
                default:
                  throw new Error(
                    `Unexpected response count: ${doStreamCalls.length}`,
                  );
              }
            },
          }),
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async () => 'result1',
            }),
          },
          runtimeContext: { context: 'state1' },
          prompt: 'test-input',
          stopWhen: isStepCount(3),
          _internal: {
            generateId: () => 'test-call-id',
            generateCallId: () => 'test-telemetry-call-id',
          },
          prepareStep: async ({
            model,
            stepNumber,
            steps,
            messages,
            runtimeContext,
          }) => {
            prepareStepCalls.push({
              modelId: typeof model === 'string' ? model : model.modelId,
              stepNumber,
              steps,
              messages,
              runtimeContext,
            });

            if (stepNumber === 0) {
              return {
                toolChoice: {
                  type: 'tool',
                  toolName: 'tool1' as const,
                },
                instructions: 'system-message-0',
                messages: [
                  {
                    role: 'user',
                    content: 'new input from prepareStep',
                  },
                ],
                runtimeContext: { context: 'state2' },
              };
            }

            if (stepNumber === 1) {
              return {
                activeTools: [],
                instructions: 'system-message-1',
                runtimeContext: { context: 'state3' },
              };
            }
          },
        });
      });

      it('should contain all doStream calls', async () => {
        await result.consumeStream();
        expect(doStreamCalls).toMatchInlineSnapshot(`
          [
            {
              "abortSignal": undefined,
              "frequencyPenalty": undefined,
              "headers": undefined,
              "includeRawChunks": false,
              "maxOutputTokens": undefined,
              "presencePenalty": undefined,
              "prompt": [
                {
                  "content": "system-message-0",
                  "role": "system",
                },
                {
                  "content": [
                    {
                      "text": "new input from prepareStep",
                      "type": "text",
                    },
                  ],
                  "providerOptions": undefined,
                  "role": "user",
                },
              ],
              "providerOptions": undefined,
              "reasoning": undefined,
              "responseFormat": undefined,
              "seed": undefined,
              "stopSequences": undefined,
              "temperature": undefined,
              "toolChoice": {
                "toolName": "tool1",
                "type": "tool",
              },
              "tools": [
                {
                  "inputSchema": {
                    "$schema": "http://json-schema.org/draft-07/schema#",
                    "additionalProperties": false,
                    "properties": {
                      "value": {
                        "type": "string",
                      },
                    },
                    "required": [
                      "value",
                    ],
                    "type": "object",
                  },
                  "name": "tool1",
                  "type": "function",
                },
              ],
              "topK": undefined,
              "topP": undefined,
            },
            {
              "abortSignal": undefined,
              "frequencyPenalty": undefined,
              "headers": undefined,
              "includeRawChunks": false,
              "maxOutputTokens": undefined,
              "presencePenalty": undefined,
              "prompt": [
                {
                  "content": "system-message-1",
                  "role": "system",
                },
                {
                  "content": [
                    {
                      "text": "new input from prepareStep",
                      "type": "text",
                    },
                  ],
                  "providerOptions": undefined,
                  "role": "user",
                },
                {
                  "content": [
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "providerOptions": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                  ],
                  "providerOptions": undefined,
                  "role": "assistant",
                },
                {
                  "content": [
                    {
                      "output": {
                        "type": "text",
                        "value": "result1",
                      },
                      "providerOptions": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "providerOptions": undefined,
                  "role": "tool",
                },
              ],
              "providerOptions": undefined,
              "reasoning": undefined,
              "responseFormat": undefined,
              "seed": undefined,
              "stopSequences": undefined,
              "temperature": undefined,
              "toolChoice": {
                "type": "auto",
              },
              "tools": undefined,
              "topK": undefined,
              "topP": undefined,
            },
          ]
        `);
      });

      it('should contain all prepareStep calls', async () => {
        await result.consumeStream();
        expect(prepareStepCalls).toMatchInlineSnapshot(`
          [
            {
              "messages": [
                {
                  "content": "test-input",
                  "role": "user",
                },
              ],
              "modelId": "mock-model-id",
              "runtimeContext": {
                "context": "state1",
              },
              "stepNumber": 0,
              "steps": [
                DefaultStepResult {
                  "callId": "test-telemetry-call-id",
                  "content": [
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "providerMetadata": undefined,
                      "title": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                    {
                      "dynamic": false,
                      "input": {
                        "value": "value",
                      },
                      "output": "result1",
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "finishReason": "tool-calls",
                  "model": {
                    "modelId": "mock-model-id",
                    "provider": "mock-provider",
                  },
                  "performance": {
                    "effectiveOutputTokensPerSecond": 0,
                    "effectiveTotalTokensPerSecond": 0,
                    "inputTokensPerSecond": 0,
                    "outputTokensPerSecond": 0,
                    "responseTimeMs": 0,
                    "stepTimeMs": 0,
                    "timeBetweenOutputChunksMs": undefined,
                    "timeToFirstOutputMs": 0,
                    "toolExecutionMs": {
                      "call-1": 0,
                    },
                  },
                  "providerMetadata": undefined,
                  "rawFinishReason": undefined,
                  "request": {
                    "body": undefined,
                    "messages": undefined,
                  },
                  "response": {
                    "headers": {
                      "call": "1",
                    },
                    "id": "id-0",
                    "messages": [
                      {
                        "content": [
                          {
                            "input": {
                              "value": "value",
                            },
                            "providerExecuted": undefined,
                            "providerOptions": undefined,
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-call",
                          },
                        ],
                        "role": "assistant",
                      },
                      {
                        "content": [
                          {
                            "output": {
                              "type": "text",
                              "value": "result1",
                            },
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-result",
                          },
                        ],
                        "role": "tool",
                      },
                    ],
                    "modelId": "mock-model-id",
                    "timestamp": 1970-01-01T00:00:00.000Z,
                  },
                  "runtimeContext": {
                    "context": "state2",
                  },
                  "stepNumber": 0,
                  "toolsContext": {},
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
                  "warnings": [],
                },
                DefaultStepResult {
                  "callId": "test-telemetry-call-id",
                  "content": [
                    {
                      "providerMetadata": undefined,
                      "text": "Hello, world!",
                      "type": "text",
                    },
                  ],
                  "finishReason": "stop",
                  "model": {
                    "modelId": "mock-model-id",
                    "provider": "mock-provider",
                  },
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
                  "request": {
                    "body": undefined,
                    "messages": undefined,
                  },
                  "response": {
                    "headers": {
                      "call": "2",
                    },
                    "id": "id-1",
                    "messages": [
                      {
                        "content": [
                          {
                            "providerOptions": undefined,
                            "text": "Hello, world!",
                            "type": "text",
                          },
                        ],
                        "role": "assistant",
                      },
                    ],
                    "modelId": "mock-model-id",
                    "timestamp": 1970-01-01T00:00:01.000Z,
                  },
                  "runtimeContext": {
                    "context": "state3",
                  },
                  "stepNumber": 1,
                  "toolsContext": {},
                  "usage": {
                    "inputTokenDetails": {
                      "cacheReadTokens": 0,
                      "cacheWriteTokens": 0,
                      "noCacheTokens": 3,
                    },
                    "inputTokens": 3,
                    "outputTokenDetails": {
                      "reasoningTokens": 10,
                      "textTokens": 10,
                    },
                    "outputTokens": 10,
                    "raw": undefined,
                    "totalTokens": 13,
                  },
                  "warnings": [],
                },
              ],
            },
            {
              "messages": [
                {
                  "content": "new input from prepareStep",
                  "role": "user",
                },
                {
                  "content": [
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "providerOptions": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                  ],
                  "role": "assistant",
                },
                {
                  "content": [
                    {
                      "output": {
                        "type": "text",
                        "value": "result1",
                      },
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "role": "tool",
                },
              ],
              "modelId": "mock-model-id",
              "runtimeContext": {
                "context": "state2",
              },
              "stepNumber": 1,
              "steps": [
                DefaultStepResult {
                  "callId": "test-telemetry-call-id",
                  "content": [
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "providerMetadata": undefined,
                      "title": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                    {
                      "dynamic": false,
                      "input": {
                        "value": "value",
                      },
                      "output": "result1",
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "finishReason": "tool-calls",
                  "model": {
                    "modelId": "mock-model-id",
                    "provider": "mock-provider",
                  },
                  "performance": {
                    "effectiveOutputTokensPerSecond": 0,
                    "effectiveTotalTokensPerSecond": 0,
                    "inputTokensPerSecond": 0,
                    "outputTokensPerSecond": 0,
                    "responseTimeMs": 0,
                    "stepTimeMs": 0,
                    "timeBetweenOutputChunksMs": undefined,
                    "timeToFirstOutputMs": 0,
                    "toolExecutionMs": {
                      "call-1": 0,
                    },
                  },
                  "providerMetadata": undefined,
                  "rawFinishReason": undefined,
                  "request": {
                    "body": undefined,
                    "messages": undefined,
                  },
                  "response": {
                    "headers": {
                      "call": "1",
                    },
                    "id": "id-0",
                    "messages": [
                      {
                        "content": [
                          {
                            "input": {
                              "value": "value",
                            },
                            "providerExecuted": undefined,
                            "providerOptions": undefined,
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-call",
                          },
                        ],
                        "role": "assistant",
                      },
                      {
                        "content": [
                          {
                            "output": {
                              "type": "text",
                              "value": "result1",
                            },
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-result",
                          },
                        ],
                        "role": "tool",
                      },
                    ],
                    "modelId": "mock-model-id",
                    "timestamp": 1970-01-01T00:00:00.000Z,
                  },
                  "runtimeContext": {
                    "context": "state2",
                  },
                  "stepNumber": 0,
                  "toolsContext": {},
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
                  "warnings": [],
                },
                DefaultStepResult {
                  "callId": "test-telemetry-call-id",
                  "content": [
                    {
                      "providerMetadata": undefined,
                      "text": "Hello, world!",
                      "type": "text",
                    },
                  ],
                  "finishReason": "stop",
                  "model": {
                    "modelId": "mock-model-id",
                    "provider": "mock-provider",
                  },
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
                  "request": {
                    "body": undefined,
                    "messages": undefined,
                  },
                  "response": {
                    "headers": {
                      "call": "2",
                    },
                    "id": "id-1",
                    "messages": [
                      {
                        "content": [
                          {
                            "providerOptions": undefined,
                            "text": "Hello, world!",
                            "type": "text",
                          },
                        ],
                        "role": "assistant",
                      },
                    ],
                    "modelId": "mock-model-id",
                    "timestamp": 1970-01-01T00:00:01.000Z,
                  },
                  "runtimeContext": {
                    "context": "state3",
                  },
                  "stepNumber": 1,
                  "toolsContext": {},
                  "usage": {
                    "inputTokenDetails": {
                      "cacheReadTokens": 0,
                      "cacheWriteTokens": 0,
                      "noCacheTokens": 3,
                    },
                    "inputTokens": 3,
                    "outputTokenDetails": {
                      "reasoningTokens": 10,
                      "textTokens": 10,
                    },
                    "outputTokens": 10,
                    "raw": undefined,
                    "totalTokens": 13,
                  },
                  "warnings": [],
                },
              ],
            },
          ]
        `);
      });
    });

    describe('2 steps: initial, tool-result with transformed tool results', () => {
      const upperCaseToolResultTransform = () =>
        new TransformStream<
          TextStreamPart<{ tool1: Tool<{ value: string }, string> }>,
          TextStreamPart<{ tool1: Tool<{ value: string }, string> }>
        >({
          transform(chunk, controller) {
            if (chunk.type === 'tool-result' && !chunk.dynamic) {
              chunk.output = chunk.output.toUpperCase();
              chunk.input = {
                ...chunk.input,
                value: chunk.input.value.toUpperCase(),
              };
            }

            controller.enqueue(chunk);
          },
        });

      beforeEach(async () => {
        let responseCount = 0;
        result = streamText({
          model: new MockLanguageModelV4({
            doStream: async ({ prompt, tools, toolChoice }) => {
              switch (responseCount++) {
                case 0: {
                  return {
                    stream: convertArrayToReadableStream([
                      {
                        type: 'response-metadata',
                        id: 'id-0',
                        modelId: 'mock-model-id',
                        timestamp: new Date(0),
                      },
                      { type: 'reasoning-start', id: 'id-0' },
                      {
                        type: 'reasoning-delta',
                        id: 'id-0',
                        delta: 'thinking',
                      },
                      { type: 'reasoning-end', id: 'id-0' },
                      {
                        type: 'tool-call',
                        toolCallId: 'call-1',
                        toolName: 'tool1',
                        input: `{ "value": "value" }`,
                      },
                      {
                        type: 'finish',
                        finishReason: { unified: 'tool-calls', raw: undefined },
                        usage: testUsage,
                      },
                    ]),
                    response: { headers: { call: '1' } },
                  };
                }
                case 1: {
                  return {
                    stream: convertArrayToReadableStream([
                      {
                        type: 'response-metadata',
                        id: 'id-1',
                        modelId: 'mock-model-id',
                        timestamp: new Date(1000),
                      },
                      { type: 'text-start', id: '1' },
                      { type: 'text-delta', id: '1', delta: 'Hello, ' },
                      { type: 'text-delta', id: '1', delta: `world!` },
                      { type: 'text-end', id: '1' },
                      {
                        type: 'finish',
                        finishReason: { unified: 'stop', raw: 'stop' },
                        usage: testUsage2,
                      },
                    ]),
                    response: { headers: { call: '2' } },
                  };
                }
                default:
                  throw new Error(
                    `Unexpected response count: ${responseCount}`,
                  );
              }
            },
          }),
          tools: {
            tool1: {
              inputSchema: z.object({ value: z.string() }),
              execute: async () => 'result1',
            },
          },
          experimental_transform: upperCaseToolResultTransform,
          prompt: 'test-input',
          onFinish: async event => {
            expect(onFinishResult).to.be.undefined;
            onFinishResult = event as unknown as typeof onFinishResult;
          },
          onStepFinish: async event => {
            onStepFinishResults.push(event);
          },
          stopWhen: isStepCount(3),
          _internal: {
            now: mockValues(0, 0, 100, 500, 600, 1000),
            generateId: mockId({ prefix: 'id' }),
            generateCallId: () => 'test-telemetry-call-id',
          },
        });
      });

      it('should contain assistant response message and tool message from all steps', async () => {
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
                "id": "id-0",
                "type": "reasoning-start",
              },
              {
                "id": "id-0",
                "providerMetadata": undefined,
                "text": "thinking",
                "type": "reasoning-delta",
              },
              {
                "id": "id-0",
                "type": "reasoning-end",
              },
              {
                "input": {
                  "value": "value",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
              {
                "dynamic": false,
                "input": {
                  "value": "VALUE",
                },
                "output": "RESULT1",
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-result",
              },
              {
                "finishReason": "tool-calls",
                "performance": {
                  "effectiveOutputTokensPerSecond": 16.666666666666668,
                  "effectiveTotalTokensPerSecond": 21.666666666666668,
                  "inputTokensPerSecond": 30,
                  "outputTokensPerSecond": 20,
                  "responseTimeMs": 600,
                  "stepTimeMs": 1000,
                  "timeBetweenOutputChunksMs": {
                    "avg": 400,
                    "max": 400,
                    "median": 400,
                    "min": 400,
                    "p10": 400,
                    "p90": 400,
                  },
                  "timeToFirstOutputMs": 100,
                  "toolExecutionMs": {
                    "call-1": 0,
                  },
                },
                "providerMetadata": undefined,
                "rawFinishReason": undefined,
                "response": {
                  "headers": {
                    "call": "1",
                  },
                  "id": "id-0",
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "type": "finish-step",
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
                "request": {
                  "body": undefined,
                  "messages": undefined,
                },
                "type": "start-step",
                "warnings": [],
              },
              {
                "id": "1",
                "type": "text-start",
              },
              {
                "id": "1",
                "providerMetadata": undefined,
                "text": "Hello, ",
                "type": "text-delta",
              },
              {
                "id": "1",
                "providerMetadata": undefined,
                "text": "world!",
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
                  "headers": {
                    "call": "2",
                  },
                  "id": "id-1",
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:01.000Z,
                },
                "type": "finish-step",
                "usage": {
                  "inputTokenDetails": {
                    "cacheReadTokens": 0,
                    "cacheWriteTokens": 0,
                    "noCacheTokens": 3,
                  },
                  "inputTokens": 3,
                  "outputTokenDetails": {
                    "reasoningTokens": 10,
                    "textTokens": 10,
                  },
                  "outputTokens": 10,
                  "raw": undefined,
                  "totalTokens": 13,
                },
              },
              {
                "finishReason": "stop",
                "rawFinishReason": "stop",
                "totalUsage": {
                  "inputTokenDetails": {
                    "cacheReadTokens": 0,
                    "cacheWriteTokens": 0,
                    "noCacheTokens": 6,
                  },
                  "inputTokens": 6,
                  "outputTokenDetails": {
                    "reasoningTokens": 10,
                    "textTokens": 20,
                  },
                  "outputTokens": 20,
                  "totalTokens": 26,
                },
                "type": "finish",
              },
            ]
          `);
      });

      describe('callbacks', () => {
        beforeEach(async () => {
          await result.consumeStream();
        });

        it('onFinish should send correct information', async () => {
          expect(onFinishResult).toMatchInlineSnapshot(`
            {
              "callId": "test-telemetry-call-id",
              "content": [
                {
                  "providerMetadata": undefined,
                  "text": "thinking",
                  "type": "reasoning",
                },
                {
                  "input": {
                    "value": "value",
                  },
                  "providerExecuted": undefined,
                  "providerMetadata": undefined,
                  "title": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
                {
                  "dynamic": false,
                  "input": {
                    "value": "VALUE",
                  },
                  "output": "RESULT1",
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
                {
                  "providerMetadata": undefined,
                  "text": "Hello, world!",
                  "type": "text",
                },
              ],
              "dynamicToolCalls": [],
              "dynamicToolResults": [],
              "files": [],
              "finalStep": DefaultStepResult {
                "callId": "test-telemetry-call-id",
                "content": [
                  {
                    "providerMetadata": undefined,
                    "text": "Hello, world!",
                    "type": "text",
                  },
                ],
                "finishReason": "stop",
                "model": {
                  "modelId": "mock-model-id",
                  "provider": "mock-provider",
                },
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
                "request": {
                  "body": undefined,
                  "messages": undefined,
                },
                "response": {
                  "headers": {
                    "call": "2",
                  },
                  "id": "id-1",
                  "messages": [
                    {
                      "content": [
                        {
                          "providerOptions": undefined,
                          "text": "Hello, world!",
                          "type": "text",
                        },
                      ],
                      "role": "assistant",
                    },
                  ],
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:01.000Z,
                },
                "runtimeContext": {},
                "stepNumber": 1,
                "toolsContext": {},
                "usage": {
                  "inputTokenDetails": {
                    "cacheReadTokens": 0,
                    "cacheWriteTokens": 0,
                    "noCacheTokens": 3,
                  },
                  "inputTokens": 3,
                  "outputTokenDetails": {
                    "reasoningTokens": 10,
                    "textTokens": 10,
                  },
                  "outputTokens": 10,
                  "raw": undefined,
                  "totalTokens": 13,
                },
                "warnings": [],
              },
              "finishReason": "stop",
              "model": {
                "modelId": "mock-model-id",
                "provider": "mock-provider",
              },
              "providerMetadata": undefined,
              "rawFinishReason": "stop",
              "reasoning": [],
              "reasoningText": undefined,
              "request": {
                "body": undefined,
                "messages": undefined,
              },
              "response": {
                "headers": {
                  "call": "2",
                },
                "id": "id-1",
                "messages": [
                  {
                    "content": [
                      {
                        "providerOptions": undefined,
                        "text": "Hello, world!",
                        "type": "text",
                      },
                    ],
                    "role": "assistant",
                  },
                ],
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:01.000Z,
              },
              "responseMessages": [
                {
                  "content": [
                    {
                      "providerOptions": undefined,
                      "text": "thinking",
                      "type": "reasoning",
                    },
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "providerOptions": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                  ],
                  "role": "assistant",
                },
                {
                  "content": [
                    {
                      "output": {
                        "type": "text",
                        "value": "RESULT1",
                      },
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "role": "tool",
                },
                {
                  "content": [
                    {
                      "providerOptions": undefined,
                      "text": "Hello, world!",
                      "type": "text",
                    },
                  ],
                  "role": "assistant",
                },
              ],
              "runtimeContext": {},
              "sources": [],
              "staticToolCalls": [
                {
                  "input": {
                    "value": "value",
                  },
                  "providerExecuted": undefined,
                  "providerMetadata": undefined,
                  "title": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
              ],
              "staticToolResults": [
                {
                  "dynamic": false,
                  "input": {
                    "value": "VALUE",
                  },
                  "output": "RESULT1",
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "stepNumber": 1,
              "steps": [
                DefaultStepResult {
                  "callId": "test-telemetry-call-id",
                  "content": [
                    {
                      "providerMetadata": undefined,
                      "text": "thinking",
                      "type": "reasoning",
                    },
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "providerMetadata": undefined,
                      "title": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                    {
                      "dynamic": false,
                      "input": {
                        "value": "VALUE",
                      },
                      "output": "RESULT1",
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "finishReason": "tool-calls",
                  "model": {
                    "modelId": "mock-model-id",
                    "provider": "mock-provider",
                  },
                  "performance": {
                    "effectiveOutputTokensPerSecond": 16.666666666666668,
                    "effectiveTotalTokensPerSecond": 21.666666666666668,
                    "inputTokensPerSecond": 30,
                    "outputTokensPerSecond": 20,
                    "responseTimeMs": 600,
                    "stepTimeMs": 1000,
                    "timeBetweenOutputChunksMs": {
                      "avg": 400,
                      "max": 400,
                      "median": 400,
                      "min": 400,
                      "p10": 400,
                      "p90": 400,
                    },
                    "timeToFirstOutputMs": 100,
                    "toolExecutionMs": {
                      "call-1": 0,
                    },
                  },
                  "providerMetadata": undefined,
                  "rawFinishReason": undefined,
                  "request": {
                    "body": undefined,
                    "messages": undefined,
                  },
                  "response": {
                    "headers": {
                      "call": "1",
                    },
                    "id": "id-0",
                    "messages": [
                      {
                        "content": [
                          {
                            "providerOptions": undefined,
                            "text": "thinking",
                            "type": "reasoning",
                          },
                          {
                            "input": {
                              "value": "value",
                            },
                            "providerExecuted": undefined,
                            "providerOptions": undefined,
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-call",
                          },
                        ],
                        "role": "assistant",
                      },
                      {
                        "content": [
                          {
                            "output": {
                              "type": "text",
                              "value": "RESULT1",
                            },
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-result",
                          },
                        ],
                        "role": "tool",
                      },
                    ],
                    "modelId": "mock-model-id",
                    "timestamp": 1970-01-01T00:00:00.000Z,
                  },
                  "runtimeContext": {},
                  "stepNumber": 0,
                  "toolsContext": {},
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
                  "warnings": [],
                },
                DefaultStepResult {
                  "callId": "test-telemetry-call-id",
                  "content": [
                    {
                      "providerMetadata": undefined,
                      "text": "Hello, world!",
                      "type": "text",
                    },
                  ],
                  "finishReason": "stop",
                  "model": {
                    "modelId": "mock-model-id",
                    "provider": "mock-provider",
                  },
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
                  "request": {
                    "body": undefined,
                    "messages": undefined,
                  },
                  "response": {
                    "headers": {
                      "call": "2",
                    },
                    "id": "id-1",
                    "messages": [
                      {
                        "content": [
                          {
                            "providerOptions": undefined,
                            "text": "Hello, world!",
                            "type": "text",
                          },
                        ],
                        "role": "assistant",
                      },
                    ],
                    "modelId": "mock-model-id",
                    "timestamp": 1970-01-01T00:00:01.000Z,
                  },
                  "runtimeContext": {},
                  "stepNumber": 1,
                  "toolsContext": {},
                  "usage": {
                    "inputTokenDetails": {
                      "cacheReadTokens": 0,
                      "cacheWriteTokens": 0,
                      "noCacheTokens": 3,
                    },
                    "inputTokens": 3,
                    "outputTokenDetails": {
                      "reasoningTokens": 10,
                      "textTokens": 10,
                    },
                    "outputTokens": 10,
                    "raw": undefined,
                    "totalTokens": 13,
                  },
                  "warnings": [],
                },
              ],
              "text": "Hello, world!",
              "toolCalls": [
                {
                  "input": {
                    "value": "value",
                  },
                  "providerExecuted": undefined,
                  "providerMetadata": undefined,
                  "title": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
              ],
              "toolResults": [
                {
                  "dynamic": false,
                  "input": {
                    "value": "VALUE",
                  },
                  "output": "RESULT1",
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "toolsContext": {},
              "totalUsage": {
                "inputTokenDetails": {
                  "cacheReadTokens": 0,
                  "cacheWriteTokens": 0,
                  "noCacheTokens": 6,
                },
                "inputTokens": 6,
                "outputTokenDetails": {
                  "reasoningTokens": 10,
                  "textTokens": 20,
                },
                "outputTokens": 20,
                "totalTokens": 26,
              },
              "usage": {
                "inputTokenDetails": {
                  "cacheReadTokens": 0,
                  "cacheWriteTokens": 0,
                  "noCacheTokens": 6,
                },
                "inputTokens": 6,
                "outputTokenDetails": {
                  "reasoningTokens": 10,
                  "textTokens": 20,
                },
                "outputTokens": 20,
                "totalTokens": 26,
              },
              "warnings": [],
            }
          `);
        });

        it('onStepFinish should send correct information', async () => {
          expect(onStepFinishResults).toMatchInlineSnapshot(`
            [
              DefaultStepResult {
                "callId": "test-telemetry-call-id",
                "content": [
                  {
                    "providerMetadata": undefined,
                    "text": "thinking",
                    "type": "reasoning",
                  },
                  {
                    "input": {
                      "value": "value",
                    },
                    "providerExecuted": undefined,
                    "providerMetadata": undefined,
                    "title": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                  {
                    "dynamic": false,
                    "input": {
                      "value": "VALUE",
                    },
                    "output": "RESULT1",
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "finishReason": "tool-calls",
                "model": {
                  "modelId": "mock-model-id",
                  "provider": "mock-provider",
                },
                "performance": {
                  "effectiveOutputTokensPerSecond": 16.666666666666668,
                  "effectiveTotalTokensPerSecond": 21.666666666666668,
                  "inputTokensPerSecond": 30,
                  "outputTokensPerSecond": 20,
                  "responseTimeMs": 600,
                  "stepTimeMs": 1000,
                  "timeBetweenOutputChunksMs": {
                    "avg": 400,
                    "max": 400,
                    "median": 400,
                    "min": 400,
                    "p10": 400,
                    "p90": 400,
                  },
                  "timeToFirstOutputMs": 100,
                  "toolExecutionMs": {
                    "call-1": 0,
                  },
                },
                "providerMetadata": undefined,
                "rawFinishReason": undefined,
                "request": {
                  "body": undefined,
                  "messages": undefined,
                },
                "response": {
                  "headers": {
                    "call": "1",
                  },
                  "id": "id-0",
                  "messages": [
                    {
                      "content": [
                        {
                          "providerOptions": undefined,
                          "text": "thinking",
                          "type": "reasoning",
                        },
                        {
                          "input": {
                            "value": "value",
                          },
                          "providerExecuted": undefined,
                          "providerOptions": undefined,
                          "toolCallId": "call-1",
                          "toolName": "tool1",
                          "type": "tool-call",
                        },
                      ],
                      "role": "assistant",
                    },
                    {
                      "content": [
                        {
                          "output": {
                            "type": "text",
                            "value": "RESULT1",
                          },
                          "toolCallId": "call-1",
                          "toolName": "tool1",
                          "type": "tool-result",
                        },
                      ],
                      "role": "tool",
                    },
                  ],
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "runtimeContext": {},
                "stepNumber": 0,
                "toolsContext": {},
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
                "warnings": [],
              },
              DefaultStepResult {
                "callId": "test-telemetry-call-id",
                "content": [
                  {
                    "providerMetadata": undefined,
                    "text": "Hello, world!",
                    "type": "text",
                  },
                ],
                "finishReason": "stop",
                "model": {
                  "modelId": "mock-model-id",
                  "provider": "mock-provider",
                },
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
                "request": {
                  "body": undefined,
                  "messages": undefined,
                },
                "response": {
                  "headers": {
                    "call": "2",
                  },
                  "id": "id-1",
                  "messages": [
                    {
                      "content": [
                        {
                          "providerOptions": undefined,
                          "text": "Hello, world!",
                          "type": "text",
                        },
                      ],
                      "role": "assistant",
                    },
                  ],
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:01.000Z,
                },
                "runtimeContext": {},
                "stepNumber": 1,
                "toolsContext": {},
                "usage": {
                  "inputTokenDetails": {
                    "cacheReadTokens": 0,
                    "cacheWriteTokens": 0,
                    "noCacheTokens": 3,
                  },
                  "inputTokens": 3,
                  "outputTokenDetails": {
                    "reasoningTokens": 10,
                    "textTokens": 10,
                  },
                  "outputTokens": 10,
                  "raw": undefined,
                  "totalTokens": 13,
                },
                "warnings": [],
              },
            ]
          `);
        });
      });

      describe('value promises', () => {
        it('result.totalUsage should contain total token usage', async () => {
          expect(await result.totalUsage).toMatchInlineSnapshot(`
            {
              "inputTokenDetails": {
                "cacheReadTokens": 0,
                "cacheWriteTokens": 0,
                "noCacheTokens": 6,
              },
              "inputTokens": 6,
              "outputTokenDetails": {
                "reasoningTokens": 10,
                "textTokens": 20,
              },
              "outputTokens": 20,
              "totalTokens": 26,
            }
          `);
        });

        it('result.usage should contain total token usage', async () => {
          expect(await result.usage).toMatchInlineSnapshot(`
            {
              "inputTokenDetails": {
                "cacheReadTokens": 0,
                "cacheWriteTokens": 0,
                "noCacheTokens": 6,
              },
              "inputTokens": 6,
              "outputTokenDetails": {
                "reasoningTokens": 10,
                "textTokens": 20,
              },
              "outputTokens": 20,
              "totalTokens": 26,
            }
          `);
        });

        it('result.finalStep.usage should contain token usage from final step', async () => {
          expect((await result.finalStep).usage).toMatchInlineSnapshot(`
            {
              "inputTokenDetails": {
                "cacheReadTokens": 0,
                "cacheWriteTokens": 0,
                "noCacheTokens": 3,
              },
              "inputTokens": 3,
              "outputTokenDetails": {
                "reasoningTokens": 10,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "raw": undefined,
              "totalTokens": 13,
            }
          `);
        });

        it('result.finishReason should contain finish reason from final step', async () => {
          assert.strictEqual(await result.finishReason, 'stop');
        });

        it('result.text should contain text from final step', async () => {
          assert.strictEqual(await result.text, 'Hello, world!');
        });

        it('result.steps should contain all steps', async () => {
          expect(await result.steps).toMatchInlineSnapshot(`
            [
              DefaultStepResult {
                "callId": "test-telemetry-call-id",
                "content": [
                  {
                    "providerMetadata": undefined,
                    "text": "thinking",
                    "type": "reasoning",
                  },
                  {
                    "input": {
                      "value": "value",
                    },
                    "providerExecuted": undefined,
                    "providerMetadata": undefined,
                    "title": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                  {
                    "dynamic": false,
                    "input": {
                      "value": "VALUE",
                    },
                    "output": "RESULT1",
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "finishReason": "tool-calls",
                "model": {
                  "modelId": "mock-model-id",
                  "provider": "mock-provider",
                },
                "performance": {
                  "effectiveOutputTokensPerSecond": 16.666666666666668,
                  "effectiveTotalTokensPerSecond": 21.666666666666668,
                  "inputTokensPerSecond": 30,
                  "outputTokensPerSecond": 20,
                  "responseTimeMs": 600,
                  "stepTimeMs": 1000,
                  "timeBetweenOutputChunksMs": {
                    "avg": 400,
                    "max": 400,
                    "median": 400,
                    "min": 400,
                    "p10": 400,
                    "p90": 400,
                  },
                  "timeToFirstOutputMs": 100,
                  "toolExecutionMs": {
                    "call-1": 0,
                  },
                },
                "providerMetadata": undefined,
                "rawFinishReason": undefined,
                "request": {
                  "body": undefined,
                  "messages": undefined,
                },
                "response": {
                  "headers": {
                    "call": "1",
                  },
                  "id": "id-0",
                  "messages": [
                    {
                      "content": [
                        {
                          "providerOptions": undefined,
                          "text": "thinking",
                          "type": "reasoning",
                        },
                        {
                          "input": {
                            "value": "value",
                          },
                          "providerExecuted": undefined,
                          "providerOptions": undefined,
                          "toolCallId": "call-1",
                          "toolName": "tool1",
                          "type": "tool-call",
                        },
                      ],
                      "role": "assistant",
                    },
                    {
                      "content": [
                        {
                          "output": {
                            "type": "text",
                            "value": "RESULT1",
                          },
                          "toolCallId": "call-1",
                          "toolName": "tool1",
                          "type": "tool-result",
                        },
                      ],
                      "role": "tool",
                    },
                  ],
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "runtimeContext": {},
                "stepNumber": 0,
                "toolsContext": {},
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
                "warnings": [],
              },
              DefaultStepResult {
                "callId": "test-telemetry-call-id",
                "content": [
                  {
                    "providerMetadata": undefined,
                    "text": "Hello, world!",
                    "type": "text",
                  },
                ],
                "finishReason": "stop",
                "model": {
                  "modelId": "mock-model-id",
                  "provider": "mock-provider",
                },
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
                "request": {
                  "body": undefined,
                  "messages": undefined,
                },
                "response": {
                  "headers": {
                    "call": "2",
                  },
                  "id": "id-1",
                  "messages": [
                    {
                      "content": [
                        {
                          "providerOptions": undefined,
                          "text": "Hello, world!",
                          "type": "text",
                        },
                      ],
                      "role": "assistant",
                    },
                  ],
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:01.000Z,
                },
                "runtimeContext": {},
                "stepNumber": 1,
                "toolsContext": {},
                "usage": {
                  "inputTokenDetails": {
                    "cacheReadTokens": 0,
                    "cacheWriteTokens": 0,
                    "noCacheTokens": 3,
                  },
                  "inputTokens": 3,
                  "outputTokenDetails": {
                    "reasoningTokens": 10,
                    "textTokens": 10,
                  },
                  "outputTokens": 10,
                  "raw": undefined,
                  "totalTokens": 13,
                },
                "warnings": [],
              },
            ]
          `);
        });

        it('result.responseMessages should contain response messages from all steps', async () => {
          expect(await result.responseMessages).toMatchInlineSnapshot(`
            [
              {
                "content": [
                  {
                    "providerOptions": undefined,
                    "text": "thinking",
                    "type": "reasoning",
                  },
                  {
                    "input": {
                      "value": "value",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                ],
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "text",
                      "value": "RESULT1",
                    },
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "role": "tool",
              },
              {
                "content": [
                  {
                    "providerOptions": undefined,
                    "text": "Hello, world!",
                    "type": "text",
                  },
                ],
                "role": "assistant",
              },
            ]
          `);
        });
      });

      it('should have correct ui message stream', async () => {
        expect(await convertReadableStreamToArray(result.toUIMessageStream()))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "start",
              },
              {
                "type": "start-step",
              },
              {
                "id": "id-0",
                "type": "reasoning-start",
              },
              {
                "delta": "thinking",
                "id": "id-0",
                "type": "reasoning-delta",
              },
              {
                "id": "id-0",
                "type": "reasoning-end",
              },
              {
                "input": {
                  "value": "value",
                },
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-input-available",
              },
              {
                "output": "RESULT1",
                "toolCallId": "call-1",
                "type": "tool-output-available",
              },
              {
                "type": "finish-step",
              },
              {
                "type": "start-step",
              },
              {
                "id": "1",
                "type": "text-start",
              },
              {
                "delta": "Hello, ",
                "id": "1",
                "type": "text-delta",
              },
              {
                "delta": "world!",
                "id": "1",
                "type": "text-delta",
              },
              {
                "id": "1",
                "type": "text-end",
              },
              {
                "type": "finish-step",
              },
              {
                "finishReason": "stop",
                "type": "finish",
              },
            ]
          `);
      });
    });

    describe('2 stop conditions', () => {
      let stopConditionCalls: Array<{
        number: number;
        steps: StepResult<any, any>[];
      }>;

      beforeEach(async () => {
        stopConditionCalls = [];

        let responseCount = 0;
        result = streamText({
          model: new MockLanguageModelV4({
            doStream: async () => {
              switch (responseCount++) {
                case 0: {
                  return {
                    stream: convertArrayToReadableStream([
                      {
                        type: 'response-metadata',
                        id: 'id-0',
                        modelId: 'mock-model-id',
                        timestamp: new Date(0),
                      },
                      {
                        type: 'reasoning-start',
                        id: 'id-0',
                      },
                      {
                        type: 'reasoning-delta',
                        id: 'id-0',
                        delta: 'thinking',
                      },
                      {
                        type: 'reasoning-end',
                        id: 'id-0',
                      },
                      {
                        type: 'tool-call',
                        id: 'call-1',
                        toolCallId: 'call-1',
                        toolName: 'tool1',
                        input: `{ "value": "value" }`,
                      },
                      {
                        type: 'finish',
                        finishReason: { unified: 'tool-calls', raw: undefined },
                        usage: testUsage,
                      },
                    ]),
                    response: { headers: { call: '1' } },
                  };
                }
                default:
                  throw new Error(
                    `Unexpected response count: ${responseCount}`,
                  );
              }
            },
          }),
          tools: {
            tool1: {
              inputSchema: z.object({ value: z.string() }),
              execute: async () => 'result1',
            },
          },
          prompt: 'test-input',
          stopWhen: [
            ({ steps }) => {
              stopConditionCalls.push({ number: 0, steps });
              return false;
            },
            ({ steps }) => {
              stopConditionCalls.push({ number: 1, steps });
              return true;
            },
          ],
          _internal: {
            now: mockValues(0, 0, 100, 500, 600, 1000),
            generateId: () => 'test-call-id',
            generateCallId: () => 'test-telemetry-call-id',
          },
        });
      });

      it('result.steps should contain a single step', async () => {
        expect((await result.steps).length).toStrictEqual(1);
      });

      it('stopConditionCalls should be called for each stop condition', async () => {
        await result.consumeStream();
        expect(stopConditionCalls).toMatchInlineSnapshot(`
          [
            {
              "number": 0,
              "steps": [
                DefaultStepResult {
                  "callId": "test-telemetry-call-id",
                  "content": [
                    {
                      "providerMetadata": undefined,
                      "text": "thinking",
                      "type": "reasoning",
                    },
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "providerMetadata": undefined,
                      "title": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                    {
                      "dynamic": false,
                      "input": {
                        "value": "value",
                      },
                      "output": "result1",
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "finishReason": "tool-calls",
                  "model": {
                    "modelId": "mock-model-id",
                    "provider": "mock-provider",
                  },
                  "performance": {
                    "effectiveOutputTokensPerSecond": 16.666666666666668,
                    "effectiveTotalTokensPerSecond": 21.666666666666668,
                    "inputTokensPerSecond": 30,
                    "outputTokensPerSecond": 20,
                    "responseTimeMs": 600,
                    "stepTimeMs": 1000,
                    "timeBetweenOutputChunksMs": {
                      "avg": 400,
                      "max": 400,
                      "median": 400,
                      "min": 400,
                      "p10": 400,
                      "p90": 400,
                    },
                    "timeToFirstOutputMs": 100,
                    "toolExecutionMs": {
                      "call-1": 0,
                    },
                  },
                  "providerMetadata": undefined,
                  "rawFinishReason": undefined,
                  "request": {
                    "body": undefined,
                    "messages": undefined,
                  },
                  "response": {
                    "headers": {
                      "call": "1",
                    },
                    "id": "id-0",
                    "messages": [
                      {
                        "content": [
                          {
                            "providerOptions": undefined,
                            "text": "thinking",
                            "type": "reasoning",
                          },
                          {
                            "input": {
                              "value": "value",
                            },
                            "providerExecuted": undefined,
                            "providerOptions": undefined,
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-call",
                          },
                        ],
                        "role": "assistant",
                      },
                      {
                        "content": [
                          {
                            "output": {
                              "type": "text",
                              "value": "result1",
                            },
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-result",
                          },
                        ],
                        "role": "tool",
                      },
                    ],
                    "modelId": "mock-model-id",
                    "timestamp": 1970-01-01T00:00:00.000Z,
                  },
                  "runtimeContext": {},
                  "stepNumber": 0,
                  "toolsContext": {},
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
                  "warnings": [],
                },
              ],
            },
            {
              "number": 1,
              "steps": [
                DefaultStepResult {
                  "callId": "test-telemetry-call-id",
                  "content": [
                    {
                      "providerMetadata": undefined,
                      "text": "thinking",
                      "type": "reasoning",
                    },
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "providerMetadata": undefined,
                      "title": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                    {
                      "dynamic": false,
                      "input": {
                        "value": "value",
                      },
                      "output": "result1",
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "finishReason": "tool-calls",
                  "model": {
                    "modelId": "mock-model-id",
                    "provider": "mock-provider",
                  },
                  "performance": {
                    "effectiveOutputTokensPerSecond": 16.666666666666668,
                    "effectiveTotalTokensPerSecond": 21.666666666666668,
                    "inputTokensPerSecond": 30,
                    "outputTokensPerSecond": 20,
                    "responseTimeMs": 600,
                    "stepTimeMs": 1000,
                    "timeBetweenOutputChunksMs": {
                      "avg": 400,
                      "max": 400,
                      "median": 400,
                      "min": 400,
                      "p10": 400,
                      "p90": 400,
                    },
                    "timeToFirstOutputMs": 100,
                    "toolExecutionMs": {
                      "call-1": 0,
                    },
                  },
                  "providerMetadata": undefined,
                  "rawFinishReason": undefined,
                  "request": {
                    "body": undefined,
                    "messages": undefined,
                  },
                  "response": {
                    "headers": {
                      "call": "1",
                    },
                    "id": "id-0",
                    "messages": [
                      {
                        "content": [
                          {
                            "providerOptions": undefined,
                            "text": "thinking",
                            "type": "reasoning",
                          },
                          {
                            "input": {
                              "value": "value",
                            },
                            "providerExecuted": undefined,
                            "providerOptions": undefined,
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-call",
                          },
                        ],
                        "role": "assistant",
                      },
                      {
                        "content": [
                          {
                            "output": {
                              "type": "text",
                              "value": "result1",
                            },
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-result",
                          },
                        ],
                        "role": "tool",
                      },
                    ],
                    "modelId": "mock-model-id",
                    "timestamp": 1970-01-01T00:00:00.000Z,
                  },
                  "runtimeContext": {},
                  "stepNumber": 0,
                  "toolsContext": {},
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
                  "warnings": [],
                },
              ],
            },
          ]
        `);
      });
    });

    it('should complete tool loop with isLoopFinished()', async () => {
      let responseCount = 0;
      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'response-metadata',
                      id: 'id-0',
                      modelId: 'mock-model-id',
                      timestamp: new Date(0),
                    },
                    {
                      type: 'tool-call',
                      id: 'call-1',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: `{ "value": "value" }`,
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'tool-calls', raw: undefined },
                      usage: testUsage,
                    },
                  ]),
                  response: {},
                };
              case 1:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'response-metadata',
                      id: 'id-1',
                      modelId: 'mock-model-id',
                      timestamp: new Date(1000),
                    },
                    { type: 'text-start', id: '1' },
                    { type: 'text-delta', id: '1', delta: 'Done!' },
                    { type: 'text-end', id: '1' },
                    {
                      type: 'finish',
                      finishReason: { unified: 'stop', raw: 'stop' },
                      usage: testUsage,
                    },
                  ]),
                  response: {},
                };
              default:
                throw new Error(`Unexpected response count: ${responseCount}`);
            }
          },
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'result1',
          },
        },
        prompt: 'test-input',
        stopWhen: isLoopFinished(),
      });

      await result.consumeStream();

      expect(await result.text).toBe('Done!');
      expect((await result.steps).length).toBe(2);
    });
  });

  describe('options.headers', () => {
    it('should set headers', async () => {
      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ headers }) => {
            expect(headers).toStrictEqual({
              'custom-request-header': 'request-header-value',
            });

            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', ' },
                { type: 'text-delta', id: '1', delta: `world!` },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        prompt: 'test-input',
        headers: { 'custom-request-header': 'request-header-value' },
      });

      assert.deepStrictEqual(
        await convertAsyncIterableToArray(result.textStream),
        ['Hello', ', ', 'world!'],
      );
    });
  });

  describe('provider-executed tools', () => {
    describe('single provider-executed tool call and result', () => {
      let result: StreamTextResult<any, any, any>;

      beforeEach(async () => {
        result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              {
                type: 'tool-input-start',
                id: 'call-1',
                toolName: 'web_search',
                providerExecuted: true,
              },
              {
                type: 'tool-input-delta',
                id: 'call-1',
                delta: '{ "value": "value" }',
              },
              {
                type: 'tool-input-end',
                id: 'call-1',
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'web_search',
                input: `{ "value": "value" }`,
                providerExecuted: true,
              },
              {
                type: 'tool-result',
                toolCallId: 'call-1',
                toolName: 'web_search',
                result: `{ "value": "result1" }`,
                providerExecuted: true,
                providerMetadata: {
                  provider: { itemId: 'result-1' },
                },
              },
              {
                type: 'tool-call',
                toolCallId: 'call-2',
                toolName: 'web_search',
                input: `{ "value": "value" }`,
                providerExecuted: true,
              },
              {
                type: 'tool-result',
                toolCallId: 'call-2',
                toolName: 'web_search',
                result: `ERROR`,
                isError: true,
                providerExecuted: true,
                providerMetadata: {
                  provider: { itemId: 'error-1' },
                },
              },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          tools: {
            web_search: {
              type: 'provider',
              isProviderExecuted: true,
              id: 'test.web_search',
              inputSchema: z.object({ value: z.string() }),
              outputSchema: z.object({ value: z.string() }),
              args: {},
            },
          },
          ...defaultSettings(),
          stopWhen: isStepCount(4),
        });
      });

      it('should only execute a single step', async () => {
        expect((await result.steps).length).toBe(1);
      });

      it('should include provider-executed tool call and result content', async () => {
        expect(await result.content).toMatchInlineSnapshot(`
          [
            {
              "input": {
                "value": "value",
              },
              "providerExecuted": true,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "web_search",
              "type": "tool-call",
            },
            {
              "dynamic": undefined,
              "input": {
                "value": "value",
              },
              "output": "{ "value": "result1" }",
              "providerExecuted": true,
              "providerMetadata": {
                "provider": {
                  "itemId": "result-1",
                },
              },
              "toolCallId": "call-1",
              "toolName": "web_search",
              "type": "tool-result",
            },
            {
              "input": {
                "value": "value",
              },
              "providerExecuted": true,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-2",
              "toolName": "web_search",
              "type": "tool-call",
            },
            {
              "dynamic": undefined,
              "error": "ERROR",
              "input": {
                "value": "value",
              },
              "providerExecuted": true,
              "providerMetadata": {
                "provider": {
                  "itemId": "error-1",
                },
              },
              "toolCallId": "call-2",
              "toolName": "web_search",
              "type": "tool-error",
            },
          ]
        `);
      });

      it('should include provider-executed tool call and result in the full stream', async () => {
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
                "dynamic": false,
                "id": "call-1",
                "providerExecuted": true,
                "title": undefined,
                "toolName": "web_search",
                "type": "tool-input-start",
              },
              {
                "delta": "{ "value": "value" }",
                "id": "call-1",
                "type": "tool-input-delta",
              },
              {
                "id": "call-1",
                "type": "tool-input-end",
              },
              {
                "input": {
                  "value": "value",
                },
                "providerExecuted": true,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "web_search",
                "type": "tool-call",
              },
              {
                "dynamic": undefined,
                "input": {
                  "value": "value",
                },
                "output": "{ "value": "result1" }",
                "providerExecuted": true,
                "providerMetadata": {
                  "provider": {
                    "itemId": "result-1",
                  },
                },
                "toolCallId": "call-1",
                "toolName": "web_search",
                "type": "tool-result",
              },
              {
                "input": {
                  "value": "value",
                },
                "providerExecuted": true,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-2",
                "toolName": "web_search",
                "type": "tool-call",
              },
              {
                "dynamic": undefined,
                "error": "ERROR",
                "input": {
                  "value": "value",
                },
                "providerExecuted": true,
                "providerMetadata": {
                  "provider": {
                    "itemId": "error-1",
                  },
                },
                "toolCallId": "call-2",
                "toolName": "web_search",
                "type": "tool-error",
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
                  "id": "id-0",
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "type": "finish-step",
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
                "finishReason": "stop",
                "rawFinishReason": "stop",
                "totalUsage": {
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
                  "totalTokens": 13,
                },
                "type": "finish",
              },
            ]
          `);
      });

      it('should include provider-executed tool call and result in the ui message stream', async () => {
        expect(await convertReadableStreamToArray(result.toUIMessageStream()))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "start",
              },
              {
                "type": "start-step",
              },
              {
                "providerExecuted": true,
                "toolCallId": "call-1",
                "toolName": "web_search",
                "type": "tool-input-start",
              },
              {
                "inputTextDelta": "{ "value": "value" }",
                "toolCallId": "call-1",
                "type": "tool-input-delta",
              },
              {
                "input": {
                  "value": "value",
                },
                "providerExecuted": true,
                "toolCallId": "call-1",
                "toolName": "web_search",
                "type": "tool-input-available",
              },
              {
                "output": "{ "value": "result1" }",
                "providerExecuted": true,
                "providerMetadata": {
                  "provider": {
                    "itemId": "result-1",
                  },
                },
                "toolCallId": "call-1",
                "type": "tool-output-available",
              },
              {
                "input": {
                  "value": "value",
                },
                "providerExecuted": true,
                "toolCallId": "call-2",
                "toolName": "web_search",
                "type": "tool-input-available",
              },
              {
                "errorText": "ERROR",
                "providerExecuted": true,
                "providerMetadata": {
                  "provider": {
                    "itemId": "error-1",
                  },
                },
                "toolCallId": "call-2",
                "type": "tool-output-error",
              },
              {
                "type": "finish-step",
              },
              {
                "finishReason": "stop",
                "type": "finish",
              },
            ]
          `);
      });
    });

    describe('provider-executed tool error with structured object preserves error in ui message stream', () => {
      it('should preserve structured error despite custom onError for provider-executed tools', async () => {
        const result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'web_fetch',
                input: `{ "url": "https://example.com" }`,
                providerExecuted: true,
              },
              {
                type: 'tool-result',
                toolCallId: 'call-1',
                toolName: 'web_fetch',
                result: {
                  type: 'web_fetch_tool_result_error',
                  errorCode: 'url_not_accessible',
                },
                isError: true,
                providerExecuted: true,
              },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          tools: {
            web_fetch: {
              type: 'provider',
              isProviderExecuted: true,
              id: 'test.web_fetch',
              inputSchema: z.object({ url: z.string() }),
              args: {},
            },
          },
          ...defaultSettings(),
          stopWhen: isStepCount(4),
        });

        const chunks = await convertReadableStreamToArray(
          result.toUIMessageStream({
            onError: () => 'Oops, an error occurred!',
          }),
        );

        const errorChunk = chunks.find(
          (c: any) => c.type === 'tool-output-error',
        );

        const parsed = JSON.parse((errorChunk as any).errorText);
        expect(parsed).toEqual({
          type: 'web_fetch_tool_result_error',
          errorCode: 'url_not_accessible',
        });
      });
    });

    describe('provider-executed tool result replay across steps', () => {
      it('should preserve provider metadata when replaying the next step', async () => {
        const stepInputs: Array<{ prompt: LanguageModelV4Prompt }> = [];
        let responseCount = 0;

        const result = streamText({
          ...defaultSettings(),
          model: new MockLanguageModelV4({
            doStream: async ({ prompt }) => {
              stepInputs.push({ prompt });

              switch (responseCount++) {
                case 0: {
                  return {
                    stream: convertArrayToReadableStream([
                      {
                        type: 'response-metadata',
                        id: 'id-0',
                        modelId: 'mock-model-id',
                        timestamp: new Date(0),
                      },
                      {
                        type: 'tool-call',
                        id: 'tool-search-call-1',
                        toolCallId: 'tool-search-call-1',
                        toolName: 'toolSearch',
                        input: JSON.stringify({
                          arguments: { paths: ['get_weather'] },
                          call_id: null,
                        }),
                        providerExecuted: true,
                        providerMetadata: {
                          openai: { itemId: 'tsc_123' },
                        },
                      },
                      {
                        type: 'tool-result',
                        toolCallId: 'tool-search-call-1',
                        toolName: 'toolSearch',
                        result: {
                          tools: [
                            {
                              type: 'function',
                              name: 'get_weather',
                              description:
                                'Get the current weather at a specific location',
                              parameters: {
                                type: 'object',
                                properties: {
                                  location: { type: 'string' },
                                },
                                required: ['location'],
                              },
                            },
                          ],
                        },
                        providerExecuted: true,
                        providerMetadata: {
                          openai: { itemId: 'tso_123' },
                        },
                      },
                      {
                        type: 'tool-call',
                        id: 'call-2',
                        toolCallId: 'call-2',
                        toolName: 'get_weather',
                        input: JSON.stringify({
                          location: 'San Francisco, CA',
                        }),
                      },
                      {
                        type: 'finish',
                        finishReason: { unified: 'tool-calls', raw: undefined },
                        usage: testUsage,
                      },
                    ]),
                    response: { headers: { call: '1' } },
                  };
                }

                case 1: {
                  return {
                    stream: convertArrayToReadableStream([
                      {
                        type: 'response-metadata',
                        id: 'id-1',
                        modelId: 'mock-model-id',
                        timestamp: new Date(1000),
                      },
                      { type: 'text-start', id: '1' },
                      { type: 'text-delta', id: '1', delta: 'Sunny.' },
                      { type: 'text-end', id: '1' },
                      {
                        type: 'finish',
                        finishReason: { unified: 'stop', raw: 'stop' },
                        usage: testUsage2,
                      },
                    ]),
                    response: { headers: { call: '2' } },
                  };
                }

                default:
                  throw new Error(
                    `Unexpected response count: ${responseCount}`,
                  );
              }
            },
          }),
          tools: {
            toolSearch: {
              type: 'provider',
              isProviderExecuted: true,
              id: 'openai.tool_search',
              inputSchema: z.object({
                arguments: z.object({
                  paths: z.array(z.string()),
                }),
                call_id: z.null(),
              }),
              outputSchema: z.object({
                tools: z.array(z.record(z.string(), z.unknown())),
              }),
              args: {},
            },
            get_weather: tool({
              inputSchema: z.object({
                location: z.string(),
              }),
              execute: async () => 'sunny',
            }),
          },
          prompt: 'test-input',
          stopWhen: isStepCount(3),
        });

        await result.consumeStream();

        expect(stepInputs).toHaveLength(2);
        expect(stepInputs[1].prompt).toEqual([
          {
            role: 'user',
            content: [{ type: 'text', text: 'test-input' }],
            providerOptions: undefined,
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'tool-search-call-1',
                toolName: 'toolSearch',
                input: {
                  arguments: { paths: ['get_weather'] },
                  call_id: null,
                },
                providerExecuted: true,
                providerOptions: {
                  openai: { itemId: 'tsc_123' },
                },
              },
              {
                type: 'tool-result',
                toolCallId: 'tool-search-call-1',
                toolName: 'toolSearch',
                output: {
                  type: 'json',
                  value: {
                    tools: [
                      {
                        type: 'function',
                        name: 'get_weather',
                        description:
                          'Get the current weather at a specific location',
                        parameters: {
                          type: 'object',
                          properties: {
                            location: { type: 'string' },
                          },
                          required: ['location'],
                        },
                      },
                    ],
                  },
                },
                providerOptions: {
                  openai: { itemId: 'tso_123' },
                },
              },
              {
                type: 'tool-call',
                toolCallId: 'call-2',
                toolName: 'get_weather',
                input: {
                  location: 'San Francisco, CA',
                },
                providerExecuted: undefined,
                providerOptions: undefined,
              },
            ],
            providerOptions: undefined,
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call-2',
                toolName: 'get_weather',
                output: {
                  type: 'text',
                  value: 'sunny',
                },
              },
            ],
            providerOptions: undefined,
          },
        ]);
      });
    });
  });

  describe('dynamic tools', () => {
    describe('single dynamic tool call and result', () => {
      let result: StreamTextResult<any, any, any>;

      beforeEach(async () => {
        result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              {
                type: 'tool-input-start',
                id: 'call-1',
                toolName: 'dynamicTool',
              },
              {
                type: 'tool-input-delta',
                id: 'call-1',
                delta: '{ "value": "value" }',
              },
              {
                type: 'tool-input-end',
                id: 'call-1',
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'dynamicTool',
                input: `{ "value": "value" }`,
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
          tools: {
            dynamicTool: dynamicTool({
              inputSchema: z.object({ value: z.string() }),
              execute: async () => {
                return { value: 'test-result' };
              },
            }),
          },
          ...defaultSettings(),
        });
      });

      it('should include dynamic tool call and result content', async () => {
        expect(await result.content).toMatchInlineSnapshot(`
          [
            {
              "dynamic": true,
              "input": {
                "value": "value",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "dynamicTool",
              "type": "tool-call",
            },
            {
              "dynamic": true,
              "input": {
                "value": "value",
              },
              "output": {
                "value": "test-result",
              },
              "toolCallId": "call-1",
              "toolName": "dynamicTool",
              "type": "tool-result",
            },
          ]
        `);
      });

      it('should include dynamic tool call and result in the full stream', async () => {
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
                "dynamic": true,
                "id": "call-1",
                "title": undefined,
                "toolName": "dynamicTool",
                "type": "tool-input-start",
              },
              {
                "delta": "{ "value": "value" }",
                "id": "call-1",
                "type": "tool-input-delta",
              },
              {
                "id": "call-1",
                "type": "tool-input-end",
              },
              {
                "dynamic": true,
                "input": {
                  "value": "value",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "dynamicTool",
                "type": "tool-call",
              },
              {
                "dynamic": true,
                "input": {
                  "value": "value",
                },
                "output": {
                  "value": "test-result",
                },
                "toolCallId": "call-1",
                "toolName": "dynamicTool",
                "type": "tool-result",
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
                  "toolExecutionMs": {
                    "call-1": 0,
                  },
                },
                "providerMetadata": undefined,
                "rawFinishReason": undefined,
                "response": {
                  "headers": undefined,
                  "id": "id-0",
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "type": "finish-step",
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
                "finishReason": "tool-calls",
                "rawFinishReason": undefined,
                "totalUsage": {
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
                  "totalTokens": 13,
                },
                "type": "finish",
              },
            ]
          `);
      });

      it('should include dynamic tool call and result in the ui message stream', async () => {
        expect(await convertReadableStreamToArray(result.toUIMessageStream()))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "start",
              },
              {
                "type": "start-step",
              },
              {
                "dynamic": true,
                "toolCallId": "call-1",
                "toolName": "dynamicTool",
                "type": "tool-input-start",
              },
              {
                "inputTextDelta": "{ "value": "value" }",
                "toolCallId": "call-1",
                "type": "tool-input-delta",
              },
              {
                "dynamic": true,
                "input": {
                  "value": "value",
                },
                "toolCallId": "call-1",
                "toolName": "dynamicTool",
                "type": "tool-input-available",
              },
              {
                "dynamic": true,
                "output": {
                  "value": "test-result",
                },
                "toolCallId": "call-1",
                "type": "tool-output-available",
              },
              {
                "type": "finish-step",
              },
              {
                "finishReason": "tool-calls",
                "type": "finish",
              },
            ]
          `);
      });
    });
  });

  describe('options.providerMetadata', () => {
    it('should pass provider metadata to model', async () => {
      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ providerOptions }) => {
            expect(providerOptions).toStrictEqual({
              aProvider: { someKey: 'someValue' },
            });

            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                {
                  type: 'text-delta',
                  id: '1',
                  delta: 'provider metadata test',
                },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        prompt: 'test-input',
        providerOptions: {
          aProvider: { someKey: 'someValue' },
        },
      });

      assert.deepStrictEqual(
        await convertAsyncIterableToArray(result.textStream),
        ['provider metadata test'],
      );
    });
  });

  describe('options.reasoning', () => {
    it('should pass reasoning to model doStream call', async () => {
      const model = new MockLanguageModelV4({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'test' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
      });

      const result = streamText({
        model,
        prompt: 'test-input',
        reasoning: 'high',
      });

      await result.text;

      expect(model.doStreamCalls[0].reasoning).toBe('high');
    });

    it('should pass through provider-default', async () => {
      const model = new MockLanguageModelV4({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'test' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
      });

      const result = streamText({
        model,
        prompt: 'test-input',
        reasoning: 'provider-default',
      });

      await result.text;

      expect(model.doStreamCalls[0].reasoning).toBe('provider-default');
    });
  });

  describe('options.abortSignal', () => {
    it('should forward abort signal to tool execution during streaming', async () => {
      const abortController = new AbortController();
      const toolExecuteMock = vi.fn().mockResolvedValue('tool result');

      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: `{ "value": "value" }`,
            },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: toolExecuteMock,
          },
        },
        prompt: 'test-input',
        abortSignal: abortController.signal,
      });

      await convertAsyncIterableToArray(result.stream);

      abortController.abort();

      expect(toolExecuteMock).toHaveBeenCalledWith(
        { value: 'value' },
        {
          abortSignal: abortController.signal,
          toolCallId: 'call-1',
          context: undefined,
          messages: expect.any(Array),
        },
      );
    });
  });

  describe('options.timeout', () => {
    it('should forward timeout as abort signal to model', async () => {
      let receivedAbortSignal: AbortSignal | undefined;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ abortSignal }) => {
            receivedAbortSignal = abortSignal;
            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        prompt: 'test-input',
        timeout: 5000,
        onError: () => {},
      });

      await result.consumeStream();

      expect(receivedAbortSignal).toBeDefined();
    });

    it('should merge timeout with abort signal', async () => {
      const abortController = new AbortController();
      let receivedAbortSignal: AbortSignal | undefined;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ abortSignal }) => {
            receivedAbortSignal = abortSignal;
            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        prompt: 'test-input',
        timeout: 5000,
        abortSignal: abortController.signal,
        onError: () => {},
      });

      await result.consumeStream();

      // The merged signal should be different from the original
      expect(receivedAbortSignal).toBeDefined();
      expect(receivedAbortSignal).not.toBe(abortController.signal);
    });

    it('should pass undefined when no timeout or abortSignal provided', async () => {
      let receivedAbortSignal: AbortSignal | undefined = 'not-set' as any;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ abortSignal }) => {
            receivedAbortSignal = abortSignal;
            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        prompt: 'test-input',
        onError: () => {},
      });

      await result.consumeStream();

      expect(receivedAbortSignal).toBeUndefined();
    });

    it('should throw Timeout error when abort signal is aborted', async () => {
      const delayedPromise = new DelayedPromise();
      const abortController = new AbortController();

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            await delayedPromise.promise;
            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        prompt: 'test-input',
        abortSignal: abortController.signal,
        onError: () => {},
      });

      abortController.abort();
      delayedPromise.resolve(undefined);

      await expect(result.text).rejects.toHaveProperty('name', 'AbortError');
    });

    it('should support timeout object with totalMs', async () => {
      let receivedAbortSignal: AbortSignal | undefined;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ abortSignal }) => {
            receivedAbortSignal = abortSignal;
            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        prompt: 'test-input',
        timeout: { totalMs: 5000 },
        onError: () => {},
      });

      await result.consumeStream();

      expect(receivedAbortSignal).toBeDefined();
    });

    it('should merge timeout object with abort signal', async () => {
      const abortController = new AbortController();
      let receivedAbortSignal: AbortSignal | undefined;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ abortSignal }) => {
            receivedAbortSignal = abortSignal;
            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        prompt: 'test-input',
        timeout: { totalMs: 5000 },
        abortSignal: abortController.signal,
        onError: () => {},
      });

      await result.consumeStream();

      // The merged signal should be different from the original
      expect(receivedAbortSignal).toBeDefined();
      expect(receivedAbortSignal).not.toBe(abortController.signal);
    });

    it('should pass undefined when timeout object has no totalMs', async () => {
      let receivedAbortSignal: AbortSignal | undefined = 'not-set' as any;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ abortSignal }) => {
            receivedAbortSignal = abortSignal;
            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        prompt: 'test-input',
        timeout: {},
        onError: () => {},
      });

      await result.consumeStream();

      expect(receivedAbortSignal).toBeUndefined();
    });

    it('should forward stepMs as abort signal to each step', async () => {
      const receivedAbortSignals: (AbortSignal | undefined)[] = [];

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ abortSignal }) => {
            receivedAbortSignals.push(abortSignal);
            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        prompt: 'test-input',
        timeout: { stepMs: 5000 },
        onError: () => {},
      });

      await result.consumeStream();

      expect(receivedAbortSignals.length).toBe(1);
      expect(receivedAbortSignals[0]).toBeDefined();
    });

    it('should reuse the same abort signal for all steps when stepMs is set', async () => {
      const receivedAbortSignals: (AbortSignal | undefined)[] = [];
      let stepCount = 0;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ abortSignal }) => {
            receivedAbortSignals.push(abortSignal);
            stepCount++;
            if (stepCount === 1) {
              return {
                stream: convertArrayToReadableStream([
                  {
                    type: 'tool-call',
                    toolCallType: 'function',
                    toolCallId: 'call-1',
                    toolName: 'tool1',
                    input: `{ "value": "test" }`,
                  },
                  {
                    type: 'finish',
                    finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
                    usage: testUsage,
                  },
                ]),
              };
            }
            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Final response' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'tool result',
          },
        },
        prompt: 'test-input',
        timeout: { stepMs: 5000 },
        stopWhen: isStepCount(2),
        onError: () => {},
      });

      await result.consumeStream();

      expect(receivedAbortSignals.length).toBe(2);
      // The same abort signal is reused for all steps (timeout is reset per step)
      expect(receivedAbortSignals[0]).toBeDefined();
      expect(receivedAbortSignals[1]).toBeDefined();
      expect(receivedAbortSignals[0]).toBe(receivedAbortSignals[1]);
    });

    it('should clear the step timeout on normal completion of a multi-step run', async () => {
      const receivedAbortSignals: (AbortSignal | undefined)[] = [];
      let stepCount = 0;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ abortSignal }) => {
            receivedAbortSignals.push(abortSignal);
            stepCount++;
            if (stepCount === 1) {
              return {
                stream: convertArrayToReadableStream([
                  {
                    type: 'tool-call',
                    toolCallType: 'function',
                    toolCallId: 'call-1',
                    toolName: 'tool1',
                    input: `{ "value": "test" }`,
                  },
                  {
                    type: 'finish',
                    finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
                    usage: testUsage,
                  },
                ]),
              };
            }
            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Final response' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'tool result',
          },
        },
        prompt: 'test-input',
        timeout: { stepMs: 50 }, // small step timeout
        stopWhen: isStepCount(2),
        onError: () => {},
      });

      // Both steps finish synchronously, well within stepMs.
      await result.consumeStream();

      // Advance well past stepMs: because each step's timeout is cleared on
      // finish, the (shared) abort signal must NOT fire. If the timers leaked,
      // a stale step timer would abort the signal here.
      await vi.advanceTimersByTimeAsync(100);

      expect(stepCount).toBe(2);
      expect(receivedAbortSignals[0]?.aborted).toBe(false);
      expect(receivedAbortSignals[1]?.aborted).toBe(false);
    });

    it('should support both totalMs and stepMs together', async () => {
      let receivedAbortSignal: AbortSignal | undefined;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ abortSignal }) => {
            receivedAbortSignal = abortSignal;
            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        prompt: 'test-input',
        timeout: { totalMs: 10000, stepMs: 5000 },
        onError: () => {},
      });

      await result.consumeStream();

      expect(receivedAbortSignal).toBeDefined();
    });

    it('should abort when step timeout expires', async () => {
      let receivedAbortSignal: AbortSignal | undefined;
      const delayedPromise = new DelayedPromise<void>();

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ abortSignal }) => {
            receivedAbortSignal = abortSignal;
            return {
              stream: new ReadableStream({
                async start(controller) {
                  // Open the stream but stall before producing any content,
                  // modelling a model that returns 200 OK and then idles.
                  // The step timeout must abort this stalled step.
                  await delayedPromise.promise;

                  controller.enqueue({ type: 'text-start', id: '1' });
                  controller.enqueue({
                    type: 'text-delta',
                    id: '1',
                    delta: 'Hello',
                  });
                  controller.enqueue({ type: 'text-end', id: '1' });
                  controller.enqueue({
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: testUsage,
                  });
                  controller.close();
                },
              }),
            };
          },
        }),
        prompt: 'test-input',
        timeout: { stepMs: 50 }, // 50ms step timeout
        onError: () => {},
      });

      // Start consuming the stream (won't complete until delayedPromise resolves)
      const consumePromise = result.consumeStream();

      // Advance time past the step timeout
      await vi.advanceTimersByTimeAsync(100);

      // Resolve the delayed promise to allow the stream to finish
      delayedPromise.resolve(undefined);

      await consumePromise;

      // The abort signal should have been triggered due to step timeout
      expect(receivedAbortSignal?.aborted).toBe(true);
      expect((receivedAbortSignal?.reason as Error)?.name).toBe('TimeoutError');
    });

    it('should forward chunkMs as abort signal to model', async () => {
      let receivedAbortSignal: AbortSignal | undefined;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ abortSignal }) => {
            receivedAbortSignal = abortSignal;
            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        prompt: 'test-input',
        timeout: { chunkMs: 5000 },
        onError: () => {},
      });

      await result.consumeStream();

      expect(receivedAbortSignal).toBeDefined();
    });

    it('should complete successfully when chunks arrive within chunkMs timeout', async () => {
      let receivedAbortSignal: AbortSignal | undefined;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ abortSignal }) => {
            receivedAbortSignal = abortSignal;
            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ' World' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        prompt: 'test-input',
        timeout: { chunkMs: 5000 }, // generous chunk timeout
        onError: () => {},
      });

      await result.consumeStream();

      // Stream should complete successfully without abort
      expect(receivedAbortSignal?.aborted).toBeFalsy();
    });

    it('should abort when chunk timeout expires', async () => {
      let receivedAbortSignal: AbortSignal | undefined;
      const delayedPromise = new DelayedPromise<void>();

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ abortSignal }) => {
            receivedAbortSignal = abortSignal;
            return {
              stream: new ReadableStream({
                async start(controller) {
                  // Send first chunk immediately
                  controller.enqueue({ type: 'text-start', id: '1' });
                  controller.enqueue({
                    type: 'text-delta',
                    id: '1',
                    delta: 'Hello',
                  });

                  // Wait for the stream to stall (will be resolved after timeout fires)
                  await delayedPromise.promise;

                  controller.enqueue({ type: 'text-end', id: '1' });
                  controller.enqueue({
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: testUsage,
                  });
                  controller.close();
                },
              }),
            };
          },
        }),
        prompt: 'test-input',
        timeout: { chunkMs: 50 }, // 50ms chunk timeout
        onError: () => {},
      });

      // Start consuming the stream (won't complete until delayedPromise resolves)
      const consumePromise = result.consumeStream();

      // Advance time past the chunk timeout
      await vi.advanceTimersByTimeAsync(100);

      // Resolve the delayed promise to allow the stream to finish
      delayedPromise.resolve(undefined);

      await consumePromise;

      // The abort signal should have been triggered due to chunk timeout
      expect(receivedAbortSignal?.aborted).toBe(true);
      expect((receivedAbortSignal?.reason as Error)?.name).toBe('TimeoutError');
    });

    it('should support chunkMs alongside totalMs and stepMs', async () => {
      let receivedAbortSignal: AbortSignal | undefined;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ abortSignal }) => {
            receivedAbortSignal = abortSignal;
            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        prompt: 'test-input',
        timeout: { totalMs: 30000, stepMs: 10000, chunkMs: 5000 },
        onError: () => {},
      });

      await result.consumeStream();

      expect(receivedAbortSignal).toBeDefined();
    });

    it('should clean up step timeout when doStream throws an error', async () => {
      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            throw new Error('Fail immediately');
          },
        }),
        prompt: 'test-input',
        maxRetries: 0,
        timeout: { stepMs: 10000 },
        onError: () => {},
      });

      await result.consumeStream();
    });
  });

  describe('tool callbacks', () => {
    it('should invoke callbacks in the correct order', async () => {
      const recordedCalls: unknown[] = [];

      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            {
              type: 'tool-input-start',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              toolName: 'test-tool',
            },
            {
              type: 'tool-input-delta',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              delta: '{"',
            },
            {
              type: 'tool-input-delta',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              delta: 'value',
            },
            {
              type: 'tool-input-delta',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              delta: '":"',
            },
            {
              type: 'tool-input-delta',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              delta: 'Spark',
            },
            {
              type: 'tool-input-delta',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              delta: 'le',
            },
            {
              type: 'tool-input-delta',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              delta: ' Day',
            },
            {
              type: 'tool-input-delta',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              delta: '"}',
            },
            {
              type: 'tool-input-end',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
            },
            {
              type: 'tool-call',
              toolCallId: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              toolName: 'test-tool',
              input: '{"value":"Sparkle Day"}',
            },
            {
              type: 'finish',
              finishReason: { unified: 'tool-calls', raw: undefined },
              usage: testUsage,
            },
          ]),
        }),
        tools: {
          'test-tool': tool({
            inputSchema: jsonSchema<{ value: string }>({
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
              additionalProperties: false,
            }),
            onInputAvailable: options => {
              recordedCalls.push({ type: 'onInputAvailable', options });
            },
            onInputStart: options => {
              recordedCalls.push({ type: 'onInputStart', options });
            },
            onInputDelta: options => {
              recordedCalls.push({ type: 'onInputDelta', options });
            },
          }),
        },
        toolChoice: 'required',
        prompt: 'test-input',
        _internal: {
          now: mockValues(0, 100, 500),
        },
      });

      await result.consumeStream();

      expect(recordedCalls).toMatchInlineSnapshot(`
        [
          {
            "options": {
              "abortSignal": undefined,
              "context": {},
              "messages": [
                {
                  "content": "test-input",
                  "role": "user",
                },
              ],
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputStart",
          },
          {
            "options": {
              "abortSignal": undefined,
              "context": {},
              "inputTextDelta": "{"",
              "messages": [
                {
                  "content": "test-input",
                  "role": "user",
                },
              ],
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputDelta",
          },
          {
            "options": {
              "abortSignal": undefined,
              "context": {},
              "inputTextDelta": "value",
              "messages": [
                {
                  "content": "test-input",
                  "role": "user",
                },
              ],
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputDelta",
          },
          {
            "options": {
              "abortSignal": undefined,
              "context": {},
              "inputTextDelta": "":"",
              "messages": [
                {
                  "content": "test-input",
                  "role": "user",
                },
              ],
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputDelta",
          },
          {
            "options": {
              "abortSignal": undefined,
              "context": {},
              "inputTextDelta": "Spark",
              "messages": [
                {
                  "content": "test-input",
                  "role": "user",
                },
              ],
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputDelta",
          },
          {
            "options": {
              "abortSignal": undefined,
              "context": {},
              "inputTextDelta": "le",
              "messages": [
                {
                  "content": "test-input",
                  "role": "user",
                },
              ],
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputDelta",
          },
          {
            "options": {
              "abortSignal": undefined,
              "context": {},
              "inputTextDelta": " Day",
              "messages": [
                {
                  "content": "test-input",
                  "role": "user",
                },
              ],
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputDelta",
          },
          {
            "options": {
              "abortSignal": undefined,
              "context": {},
              "inputTextDelta": ""}",
              "messages": [
                {
                  "content": "test-input",
                  "role": "user",
                },
              ],
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputDelta",
          },
          {
            "options": {
              "abortSignal": undefined,
              "context": {},
              "input": {
                "value": "Sparkle Day",
              },
              "messages": [
                {
                  "content": "test-input",
                  "role": "user",
                },
              ],
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputAvailable",
          },
        ]
      `);
    });
  });

  describe('tools with custom schema', () => {
    it('should send tool calls', async () => {
      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ prompt, tools, toolChoice }) => {
            expect(tools).toStrictEqual([
              {
                type: 'function',
                name: 'tool1',
                inputSchema: {
                  additionalProperties: false,
                  properties: { value: { type: 'string' } },
                  required: ['value'],
                  type: 'object',
                },
              },
            ]);
            expect(toolChoice).toStrictEqual({ type: 'required' });

            expect(prompt).toStrictEqual([
              {
                role: 'user',
                content: [{ type: 'text', text: 'test-input' }],
                providerOptions: undefined,
              },
            ]);

            return {
              stream: convertArrayToReadableStream([
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                {
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  input: `{ "value": "value" }`,
                },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        tools: {
          tool1: {
            title: 'Tool 1',
            inputSchema: jsonSchema<{ value: string }>({
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
              additionalProperties: false,
            }),
          },
        },
        toolChoice: 'required',
        prompt: 'test-input',
        _internal: {
          now: mockValues(0, 100, 500),
        },
      });

      expect(
        await convertAsyncIterableToArray(result.stream),
      ).toMatchSnapshot();
    });
  });

  describe('options.messages', () => {
    it('should support models that use "this" context in supportedUrls', async () => {
      let supportedUrlsCalled = false;
      class MockLanguageModelWithImageSupport extends MockLanguageModelV4 {
        constructor() {
          super({
            supportedUrls() {
              supportedUrlsCalled = true;
              // Reference 'this' to verify context
              return this.modelId === 'mock-model-id'
                ? ({ 'image/*': [/^https:\/\/.*$/] } as Record<
                    string,
                    RegExp[]
                  >)
                : {};
            },
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', ' },
                { type: 'text-delta', id: '1', delta: 'world!' },
                { type: 'text-end', id: '1' },
              ]),
            }),
          });
        }
      }

      const model = new MockLanguageModelWithImageSupport();
      const result = streamText({
        model,
        messages: [
          {
            role: 'user',
            content: [{ type: 'image', image: 'https://example.com/test.jpg' }],
          },
        ],
      });

      await result.consumeStream();

      expect(supportedUrlsCalled).toBe(true);
      expect(await result.text).toBe('Hello, world!');
    });
  });

  describe('tool execution errors', () => {
    let result: StreamTextResult<any, any, any>;

    beforeEach(async () => {
      result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: `{ "value": "value" }`,
            },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async (): Promise<string> => {
              throw new Error('test error');
            },
          }),
        },
        ...defaultSettings(),
      });
    });

    it('should include tool error part in the full stream', async () => {
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
              "input": {
                "value": "value",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
            {
              "dynamic": false,
              "error": [Error: test error],
              "input": {
                "value": "value",
              },
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-error",
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
                "toolExecutionMs": {
                  "call-1": 0,
                },
              },
              "providerMetadata": undefined,
              "rawFinishReason": "stop",
              "response": {
                "headers": undefined,
                "id": "id-0",
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "type": "finish-step",
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
              "finishReason": "stop",
              "rawFinishReason": "stop",
              "totalUsage": {
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
                "totalTokens": 13,
              },
              "type": "finish",
            },
          ]
        `);
    });

    it('should include the error part in the step stream', async () => {
      expect(await result.steps).toMatchInlineSnapshot(`
        [
          DefaultStepResult {
            "callId": "test-telemetry-call-id",
            "content": [
              {
                "input": {
                  "value": "value",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
              {
                "dynamic": false,
                "error": [Error: test error],
                "input": {
                  "value": "value",
                },
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-error",
              },
            ],
            "finishReason": "stop",
            "model": {
              "modelId": "mock-model-id",
              "provider": "mock-provider",
            },
            "performance": {
              "effectiveOutputTokensPerSecond": 0,
              "effectiveTotalTokensPerSecond": 0,
              "inputTokensPerSecond": 0,
              "outputTokensPerSecond": 0,
              "responseTimeMs": 0,
              "stepTimeMs": 0,
              "timeBetweenOutputChunksMs": undefined,
              "timeToFirstOutputMs": 0,
              "toolExecutionMs": {
                "call-1": 0,
              },
            },
            "providerMetadata": undefined,
            "rawFinishReason": "stop",
            "request": {
              "body": undefined,
              "messages": undefined,
            },
            "response": {
              "headers": undefined,
              "id": "id-0",
              "messages": [
                {
                  "content": [
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "providerOptions": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                  ],
                  "role": "assistant",
                },
                {
                  "content": [
                    {
                      "output": {
                        "type": "error-text",
                        "value": "Error: test error",
                      },
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "role": "tool",
                },
              ],
              "modelId": "mock-model-id",
              "timestamp": 1970-01-01T00:00:00.000Z,
            },
            "runtimeContext": {},
            "stepNumber": 0,
            "toolsContext": {},
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
            "warnings": [],
          },
        ]
      `);
    });

    it('should include error result in response messages', async () => {
      expect(await result.responseMessages).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "input": {
                  "value": "value",
                },
                "providerExecuted": undefined,
                "providerOptions": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "output": {
                  "type": "error-text",
                  "value": "Error: test error",
                },
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-result",
              },
            ],
            "role": "tool",
          },
        ]
      `);
    });

    it('should add tool-error parts to ui message stream', async () => {
      expect(await convertReadableStreamToArray(result.toUIMessageStream()))
        .toMatchInlineSnapshot(`
          [
            {
              "type": "start",
            },
            {
              "type": "start-step",
            },
            {
              "input": {
                "value": "value",
              },
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-input-available",
            },
            {
              "errorText": "An error occurred.",
              "toolCallId": "call-1",
              "type": "tool-output-error",
            },
            {
              "type": "finish-step",
            },
            {
              "finishReason": "stop",
              "type": "finish",
            },
          ]
        `);
    });
  });

  describe('options.transform', () => {
    describe('with base transformation', () => {
      const upperCaseTransform = () =>
        new TransformStream<
          TextStreamPart<{ tool1: Tool<{ value: string }> }>,
          TextStreamPart<{ tool1: Tool<{ value: string }> }>
        >({
          transform(chunk, controller) {
            if (
              chunk.type === 'text-delta' ||
              chunk.type === 'reasoning-delta'
            ) {
              chunk.text = chunk.text.toUpperCase();
            }

            if (chunk.type === 'tool-input-delta') {
              chunk.delta = chunk.delta.toUpperCase();
            }

            // assuming test arg structure:
            if (chunk.type === 'tool-call' && !chunk.dynamic) {
              chunk.input = {
                ...chunk.input,
                value: chunk.input.value.toUpperCase(),
              };
            }

            if (chunk.type === 'tool-result' && !chunk.dynamic) {
              chunk.output = chunk.output.toUpperCase();
              chunk.input = {
                ...chunk.input,
                value: chunk.input.value.toUpperCase(),
              };
            }

            if (chunk.type === 'finish-step') {
              if (chunk.providerMetadata?.testProvider != null) {
                chunk.providerMetadata.testProvider = {
                  testKey: 'TEST VALUE',
                };
              }
            }

            controller.enqueue(chunk);
          },
        });

      it('should transform the stream', async () => {
        const result = streamText({
          model: createTestModel(),
          experimental_transform: upperCaseTransform,
          prompt: 'test-input',
        });

        expect(
          await convertAsyncIterableToArray(result.textStream),
        ).toStrictEqual(['HELLO', ', ', 'WORLD!']);
      });

      it('result.text should be transformed', async () => {
        const result = streamText({
          model: createTestModel(),
          experimental_transform: upperCaseTransform,
          prompt: 'test-input',
        });

        expect(await result.text).toStrictEqual('HELLO, WORLD!');
      });

      it('result.responseMessages should be transformed', async () => {
        const result = streamText({
          model: createTestModel(),
          experimental_transform: upperCaseTransform,
          prompt: 'test-input',
        });

        expect(await result.response).toStrictEqual({
          id: expect.any(String),
          timestamp: expect.any(Date),
          modelId: expect.any(String),
          headers: undefined,
          messages: [
            {
              role: 'assistant',
              content: [
                {
                  providerOptions: undefined,
                  text: 'HELLO, WORLD!',
                  type: 'text',
                },
              ],
            },
          ],
        });
      });

      it('result.totalUsage should be transformed', async () => {
        const result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          experimental_transform: () =>
            new TransformStream<TextStreamPart<any>, TextStreamPart<any>>({
              transform(chunk, controller) {
                if (chunk.type === 'finish') {
                  chunk.totalUsage = {
                    inputTokens: 200,
                    inputTokenDetails: {
                      noCacheTokens: 200,
                      cacheReadTokens: undefined,
                      cacheWriteTokens: undefined,
                    },
                    outputTokens: 300,
                    outputTokenDetails: {
                      reasoningTokens: undefined,
                      textTokens: 300,
                    },
                    totalTokens: undefined,
                  };
                }
                controller.enqueue(chunk);
              },
            }),
          prompt: 'test-input',
        });

        expect(await result.totalUsage).toMatchInlineSnapshot(`
          {
            "inputTokenDetails": {
              "cacheReadTokens": undefined,
              "cacheWriteTokens": undefined,
              "noCacheTokens": 200,
            },
            "inputTokens": 200,
            "outputTokenDetails": {
              "reasoningTokens": undefined,
              "textTokens": 300,
            },
            "outputTokens": 300,
            "totalTokens": undefined,
          }
        `);
      });

      it('result.finishReason should be transformed', async () => {
        const result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'length', raw: 'raw-length' },
                usage: testUsage,
              },
            ]),
          }),
          experimental_transform: () =>
            new TransformStream<TextStreamPart<any>, TextStreamPart<any>>({
              transform(chunk, controller) {
                if (chunk.type === 'finish') {
                  chunk.finishReason = 'stop';
                }
                controller.enqueue(chunk);
              },
            }),
          prompt: 'test-input',
        });

        expect(await result.finishReason).toStrictEqual('stop');
      });

      it('result.toolCalls should be transformed', async () => {
        const result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello, ' },
              { type: 'text-delta', id: '1', delta: 'world!' },
              { type: 'text-end', id: '1' },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: `{ "value": "value" }`,
              },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          tools: {
            tool1: {
              inputSchema: z.object({ value: z.string() }),
              execute: async () => 'result1',
            },
          },
          experimental_transform: upperCaseTransform,
          prompt: 'test-input',
        });

        expect(await result.toolCalls).toMatchInlineSnapshot(`
          [
            {
              "input": {
                "value": "VALUE",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
          ]
        `);
      });

      it('result.toolResults should be transformed', async () => {
        const result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello, ' },
              { type: 'text-delta', id: '1', delta: 'world!' },
              { type: 'text-end', id: '1' },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: `{ "value": "value" }`,
              },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          tools: {
            tool1: {
              inputSchema: z.object({ value: z.string() }),
              execute: async () => 'result1',
            },
          },
          experimental_transform: upperCaseTransform,
          prompt: 'test-input',
        });

        expect(await result.toolResults).toMatchInlineSnapshot(`
          [
            {
              "dynamic": false,
              "input": {
                "value": "VALUE",
              },
              "output": "RESULT1",
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-result",
            },
          ]
        `);
      });

      it('result.steps should be transformed', async () => {
        const result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello, ' },
              { type: 'text-delta', id: '1', delta: 'world!' },
              { type: 'text-end', id: '1' },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: `{ "value": "value" }`,
              },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          tools: {
            tool1: {
              inputSchema: z.object({ value: z.string() }),
              execute: async () => 'result1',
            },
          },
          experimental_transform: upperCaseTransform,
          prompt: 'test-input',
          _internal: {
            generateId: () => 'test-call-id',
            generateCallId: () => 'test-telemetry-call-id',
          },
        });

        expect(await result.steps).toMatchInlineSnapshot(`
          [
            DefaultStepResult {
              "callId": "test-telemetry-call-id",
              "content": [
                {
                  "providerMetadata": undefined,
                  "text": "HELLO, WORLD!",
                  "type": "text",
                },
                {
                  "input": {
                    "value": "VALUE",
                  },
                  "providerExecuted": undefined,
                  "providerMetadata": undefined,
                  "title": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
                {
                  "dynamic": false,
                  "input": {
                    "value": "VALUE",
                  },
                  "output": "RESULT1",
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "finishReason": "stop",
              "model": {
                "modelId": "mock-model-id",
                "provider": "mock-provider",
              },
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
                "toolExecutionMs": {
                  "call-1": 0,
                },
              },
              "providerMetadata": undefined,
              "rawFinishReason": "stop",
              "request": {
                "body": undefined,
                "messages": undefined,
              },
              "response": {
                "headers": undefined,
                "id": "id-0",
                "messages": [
                  {
                    "content": [
                      {
                        "providerOptions": undefined,
                        "text": "HELLO, WORLD!",
                        "type": "text",
                      },
                      {
                        "input": {
                          "value": "VALUE",
                        },
                        "providerExecuted": undefined,
                        "providerOptions": undefined,
                        "toolCallId": "call-1",
                        "toolName": "tool1",
                        "type": "tool-call",
                      },
                    ],
                    "role": "assistant",
                  },
                  {
                    "content": [
                      {
                        "output": {
                          "type": "text",
                          "value": "RESULT1",
                        },
                        "toolCallId": "call-1",
                        "toolName": "tool1",
                        "type": "tool-result",
                      },
                    ],
                    "role": "tool",
                  },
                ],
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "runtimeContext": {},
              "stepNumber": 0,
              "toolsContext": {},
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
              "warnings": [],
            },
          ]
        `);
      });

      it('result.providerMetadata should be transformed', async () => {
        const result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
                providerMetadata: {
                  testProvider: {
                    testKey: 'testValue',
                  },
                },
              },
            ]),
            request: { body: 'test body' },
          }),
          prompt: 'test-input',
          experimental_transform: upperCaseTransform,
        });

        expect(JSON.stringify(await result.providerMetadata)).toStrictEqual(
          JSON.stringify({
            testProvider: {
              testKey: 'TEST VALUE',
            },
          }),
        );
      });

      it('options.onFinish should receive transformed data', async () => {
        let result!: Parameters<
          Required<Parameters<typeof streamText>[0]>['onFinish']
        >[0];

        const resultObject = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello' },
              { type: 'text-delta', id: '1', delta: ', ' },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: `{ "value": "value" }`,
              },
              { type: 'text-delta', id: '1', delta: 'world!' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
                providerMetadata: {
                  testProvider: { testKey: 'testValue' },
                },
              },
            ]),
            response: { headers: { call: '2' } },
          }),
          tools: {
            tool1: {
              inputSchema: z.object({ value: z.string() }),
              execute: async ({ value }) => `${value}-result`,
            },
          },
          prompt: 'test-input',
          onFinish: async event => {
            result = event as unknown as typeof result;
          },
          experimental_transform: upperCaseTransform,
          _internal: {
            generateId: () => 'test-call-id',
            generateCallId: () => 'test-telemetry-call-id',
          },
        });

        await resultObject.consumeStream();

        expect(result).toMatchInlineSnapshot(`
          {
            "callId": "test-telemetry-call-id",
            "content": [
              {
                "providerMetadata": undefined,
                "text": "HELLO, WORLD!",
                "type": "text",
              },
              {
                "input": {
                  "value": "VALUE",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
              {
                "dynamic": false,
                "input": {
                  "value": "VALUE",
                },
                "output": "VALUE-RESULT",
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-result",
              },
            ],
            "dynamicToolCalls": [],
            "dynamicToolResults": [],
            "files": [],
            "finalStep": DefaultStepResult {
              "callId": "test-telemetry-call-id",
              "content": [
                {
                  "providerMetadata": undefined,
                  "text": "HELLO, WORLD!",
                  "type": "text",
                },
                {
                  "input": {
                    "value": "VALUE",
                  },
                  "providerExecuted": undefined,
                  "providerMetadata": undefined,
                  "title": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
                {
                  "dynamic": false,
                  "input": {
                    "value": "VALUE",
                  },
                  "output": "VALUE-RESULT",
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "finishReason": "stop",
              "model": {
                "modelId": "mock-model-id",
                "provider": "mock-provider",
              },
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
                "toolExecutionMs": {
                  "call-1": 0,
                },
              },
              "providerMetadata": {
                "testProvider": {
                  "testKey": "TEST VALUE",
                },
              },
              "rawFinishReason": "stop",
              "request": {
                "body": undefined,
                "messages": undefined,
              },
              "response": {
                "headers": {
                  "call": "2",
                },
                "id": "id-0",
                "messages": [
                  {
                    "content": [
                      {
                        "providerOptions": undefined,
                        "text": "HELLO, WORLD!",
                        "type": "text",
                      },
                      {
                        "input": {
                          "value": "VALUE",
                        },
                        "providerExecuted": undefined,
                        "providerOptions": undefined,
                        "toolCallId": "call-1",
                        "toolName": "tool1",
                        "type": "tool-call",
                      },
                    ],
                    "role": "assistant",
                  },
                  {
                    "content": [
                      {
                        "output": {
                          "type": "text",
                          "value": "VALUE-RESULT",
                        },
                        "toolCallId": "call-1",
                        "toolName": "tool1",
                        "type": "tool-result",
                      },
                    ],
                    "role": "tool",
                  },
                ],
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "runtimeContext": {},
              "stepNumber": 0,
              "toolsContext": {},
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
              "warnings": [],
            },
            "finishReason": "stop",
            "model": {
              "modelId": "mock-model-id",
              "provider": "mock-provider",
            },
            "providerMetadata": {
              "testProvider": {
                "testKey": "TEST VALUE",
              },
            },
            "rawFinishReason": "stop",
            "reasoning": [],
            "reasoningText": undefined,
            "request": {
              "body": undefined,
              "messages": undefined,
            },
            "response": {
              "headers": {
                "call": "2",
              },
              "id": "id-0",
              "messages": [
                {
                  "content": [
                    {
                      "providerOptions": undefined,
                      "text": "HELLO, WORLD!",
                      "type": "text",
                    },
                    {
                      "input": {
                        "value": "VALUE",
                      },
                      "providerExecuted": undefined,
                      "providerOptions": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                  ],
                  "role": "assistant",
                },
                {
                  "content": [
                    {
                      "output": {
                        "type": "text",
                        "value": "VALUE-RESULT",
                      },
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "role": "tool",
                },
              ],
              "modelId": "mock-model-id",
              "timestamp": 1970-01-01T00:00:00.000Z,
            },
            "responseMessages": [
              {
                "content": [
                  {
                    "providerOptions": undefined,
                    "text": "HELLO, WORLD!",
                    "type": "text",
                  },
                  {
                    "input": {
                      "value": "VALUE",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                ],
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "text",
                      "value": "VALUE-RESULT",
                    },
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "role": "tool",
              },
            ],
            "runtimeContext": {},
            "sources": [],
            "staticToolCalls": [
              {
                "input": {
                  "value": "VALUE",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
            ],
            "staticToolResults": [
              {
                "dynamic": false,
                "input": {
                  "value": "VALUE",
                },
                "output": "VALUE-RESULT",
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-result",
              },
            ],
            "stepNumber": 0,
            "steps": [
              DefaultStepResult {
                "callId": "test-telemetry-call-id",
                "content": [
                  {
                    "providerMetadata": undefined,
                    "text": "HELLO, WORLD!",
                    "type": "text",
                  },
                  {
                    "input": {
                      "value": "VALUE",
                    },
                    "providerExecuted": undefined,
                    "providerMetadata": undefined,
                    "title": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                  {
                    "dynamic": false,
                    "input": {
                      "value": "VALUE",
                    },
                    "output": "VALUE-RESULT",
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "finishReason": "stop",
                "model": {
                  "modelId": "mock-model-id",
                  "provider": "mock-provider",
                },
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
                  "toolExecutionMs": {
                    "call-1": 0,
                  },
                },
                "providerMetadata": {
                  "testProvider": {
                    "testKey": "TEST VALUE",
                  },
                },
                "rawFinishReason": "stop",
                "request": {
                  "body": undefined,
                  "messages": undefined,
                },
                "response": {
                  "headers": {
                    "call": "2",
                  },
                  "id": "id-0",
                  "messages": [
                    {
                      "content": [
                        {
                          "providerOptions": undefined,
                          "text": "HELLO, WORLD!",
                          "type": "text",
                        },
                        {
                          "input": {
                            "value": "VALUE",
                          },
                          "providerExecuted": undefined,
                          "providerOptions": undefined,
                          "toolCallId": "call-1",
                          "toolName": "tool1",
                          "type": "tool-call",
                        },
                      ],
                      "role": "assistant",
                    },
                    {
                      "content": [
                        {
                          "output": {
                            "type": "text",
                            "value": "VALUE-RESULT",
                          },
                          "toolCallId": "call-1",
                          "toolName": "tool1",
                          "type": "tool-result",
                        },
                      ],
                      "role": "tool",
                    },
                  ],
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "runtimeContext": {},
                "stepNumber": 0,
                "toolsContext": {},
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
                "warnings": [],
              },
            ],
            "text": "HELLO, WORLD!",
            "toolCalls": [
              {
                "input": {
                  "value": "VALUE",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
            ],
            "toolResults": [
              {
                "dynamic": false,
                "input": {
                  "value": "VALUE",
                },
                "output": "VALUE-RESULT",
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-result",
              },
            ],
            "toolsContext": {},
            "totalUsage": {
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
              "totalTokens": 13,
            },
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
              "totalTokens": 13,
            },
            "warnings": [],
          }
        `);
      });

      it('options.onStepFinish should receive transformed data', async () => {
        let result!: Parameters<
          Required<Parameters<typeof streamText>[0]>['onStepFinish']
        >[0];

        const resultObject = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello' },
              { type: 'text-delta', id: '1', delta: ', ' },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: `{ "value": "value" }`,
              },
              { type: 'text-delta', id: '1', delta: 'world!' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
                providerMetadata: {
                  testProvider: { testKey: 'testValue' },
                },
              },
            ]),
            response: { headers: { call: '2' } },
          }),
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async ({ value }) => `${value}-result`,
            }),
          },
          prompt: 'test-input',
          onStepFinish: async event => {
            result = event as unknown as typeof result;
          },
          experimental_transform: upperCaseTransform,
          _internal: {
            generateId: () => 'test-call-id',
            generateCallId: () => 'test-telemetry-call-id',
          },
        });

        await resultObject.consumeStream();

        expect(result).toMatchInlineSnapshot(`
          DefaultStepResult {
            "callId": "test-telemetry-call-id",
            "content": [
              {
                "providerMetadata": undefined,
                "text": "HELLO, WORLD!",
                "type": "text",
              },
              {
                "input": {
                  "value": "VALUE",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
              {
                "dynamic": false,
                "input": {
                  "value": "VALUE",
                },
                "output": "VALUE-RESULT",
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-result",
              },
            ],
            "finishReason": "stop",
            "model": {
              "modelId": "mock-model-id",
              "provider": "mock-provider",
            },
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
              "toolExecutionMs": {
                "call-1": 0,
              },
            },
            "providerMetadata": {
              "testProvider": {
                "testKey": "TEST VALUE",
              },
            },
            "rawFinishReason": "stop",
            "request": {
              "body": undefined,
              "messages": undefined,
            },
            "response": {
              "headers": {
                "call": "2",
              },
              "id": "id-0",
              "messages": [
                {
                  "content": [
                    {
                      "providerOptions": undefined,
                      "text": "HELLO, WORLD!",
                      "type": "text",
                    },
                    {
                      "input": {
                        "value": "VALUE",
                      },
                      "providerExecuted": undefined,
                      "providerOptions": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                  ],
                  "role": "assistant",
                },
                {
                  "content": [
                    {
                      "output": {
                        "type": "text",
                        "value": "VALUE-RESULT",
                      },
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "role": "tool",
                },
              ],
              "modelId": "mock-model-id",
              "timestamp": 1970-01-01T00:00:00.000Z,
            },
            "runtimeContext": {},
            "stepNumber": 0,
            "toolsContext": {},
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
            "warnings": [],
          }
        `);
      });

      it('it should send transformed chunks to onChunk', async () => {
        const result: Array<TextStreamPart<any>> = [];

        const resultObject = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello' },
              { type: 'reasoning-start', id: '2' },
              { type: 'reasoning-delta', id: '2', delta: 'Feeling clever' },
              { type: 'reasoning-end', id: '2' },
              { type: 'tool-input-start', id: 'call-1', toolName: 'tool1' },
              { type: 'tool-input-delta', id: 'call-1', delta: '{"value": "' },
              { type: 'tool-input-delta', id: 'call-1', delta: 'test' },
              { type: 'tool-input-delta', id: 'call-1', delta: '"}' },
              { type: 'tool-input-end', id: 'call-1' },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: `{ "value": "test" }`,
              },
              { type: 'text-delta', id: '1', delta: ' World' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          tools: {
            tool1: {
              inputSchema: z.object({ value: z.string() }),
              execute: async ({ value }) => `${value}-result`,
            },
          },
          prompt: 'test-input',
          _internal: {
            generateId: mockId({ prefix: 'id' }),
            generateCallId: () => 'test-telemetry-call-id',
          },
          onChunk(event) {
            result.push(event.chunk);
          },
          experimental_transform: upperCaseTransform,
        });

        await resultObject.consumeStream();

        expect(result).toMatchInlineSnapshot(`
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
              "id": "1",
              "type": "text-start",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": "HELLO",
              "type": "text-delta",
            },
            {
              "id": "2",
              "type": "reasoning-start",
            },
            {
              "id": "2",
              "providerMetadata": undefined,
              "text": "FEELING CLEVER",
              "type": "reasoning-delta",
            },
            {
              "id": "2",
              "type": "reasoning-end",
            },
            {
              "dynamic": false,
              "id": "call-1",
              "title": undefined,
              "toolName": "tool1",
              "type": "tool-input-start",
            },
            {
              "delta": "{"VALUE": "",
              "id": "call-1",
              "type": "tool-input-delta",
            },
            {
              "delta": "TEST",
              "id": "call-1",
              "type": "tool-input-delta",
            },
            {
              "delta": ""}",
              "id": "call-1",
              "type": "tool-input-delta",
            },
            {
              "id": "call-1",
              "type": "tool-input-end",
            },
            {
              "input": {
                "value": "TEST",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": " WORLD",
              "type": "text-delta",
            },
            {
              "id": "1",
              "type": "text-end",
            },
            {
              "dynamic": false,
              "input": {
                "value": "TEST",
              },
              "output": "TEST-RESULT",
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-result",
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
                "toolExecutionMs": {
                  "call-1": 0,
                },
              },
              "providerMetadata": undefined,
              "rawFinishReason": "stop",
              "response": {
                "headers": undefined,
                "id": "id-0",
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "type": "finish-step",
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
              "finishReason": "stop",
              "rawFinishReason": "stop",
              "totalUsage": {
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
                "totalTokens": 13,
              },
              "type": "finish",
            },
          ]
        `);
      });
    });

    describe('with multiple transformations', () => {
      const toUppercaseAndAddCommaTransform =
        <TOOLS extends ToolSet>() =>
        (options: { tools: TOOLS }) =>
          new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
            transform(chunk, controller) {
              if (chunk.type !== 'text-delta') {
                controller.enqueue(chunk);
                return;
              }

              controller.enqueue({
                ...chunk,
                text: `${chunk.text.toUpperCase()},`,
              });
            },
          });

      const omitCommaTransform =
        <TOOLS extends ToolSet>() =>
        (options: { tools: TOOLS }) =>
          new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
            transform(chunk, controller) {
              if (chunk.type !== 'text-delta') {
                controller.enqueue(chunk);
                return;
              }

              controller.enqueue({
                ...chunk,
                text: chunk.text.replaceAll(',', ''),
              });
            },
          });

      it('should transform the stream', async () => {
        const result = streamText({
          model: createTestModel(),
          experimental_transform: [
            toUppercaseAndAddCommaTransform(),
            omitCommaTransform(),
          ],
          prompt: 'test-input',
        });

        expect(
          await convertAsyncIterableToArray(result.textStream),
        ).toStrictEqual(['HELLO', ' ', 'WORLD!']);
      });
    });

    describe('with transformation that aborts stream', () => {
      const stopWordTransform =
        <TOOLS extends ToolSet>() =>
        ({ stopStream }: { stopStream: () => void }) =>
          new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
            // note: this is a simplified transformation for testing;
            // in a real-world version more there would need to be
            // stream buffering and scanning to correctly emit prior text
            // and to detect all STOP occurrences.
            transform(chunk, controller) {
              if (chunk.type !== 'text-delta') {
                controller.enqueue(chunk);
                return;
              }

              if (chunk.text.includes('STOP')) {
                stopStream();

                controller.enqueue({
                  type: 'finish-step',
                  finishReason: 'stop',
                  rawFinishReason: undefined,
                  providerMetadata: undefined,
                  usage: createNullLanguageModelUsage(),
                  performance: {
                    stepTimeMs: 0,
                    responseTimeMs: 0,
                    effectiveOutputTokensPerSecond: 0,
                    outputTokensPerSecond: undefined,
                    inputTokensPerSecond: undefined,
                    effectiveTotalTokensPerSecond: 0,
                    toolExecutionMs: {},
                    timeToFirstOutputMs: undefined,
                  },
                  response: {
                    id: 'response-id',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                });

                controller.enqueue({
                  type: 'finish',
                  finishReason: 'stop',
                  rawFinishReason: undefined,
                  totalUsage: createNullLanguageModelUsage(),
                });

                return;
              }

              controller.enqueue(chunk);
            },
          });

      it('stream should stop when STOP token is encountered', async () => {
        await expectUndefinedUnhandledRejections({
          fn: async () => {
            const result = streamText({
              model: createTestModel({
                stream: convertArrayToReadableStream([
                  { type: 'text-start', id: '1' },
                  { type: 'text-delta', id: '1', delta: 'Hello, ' },
                  { type: 'text-delta', id: '1', delta: 'STOP' },
                  { type: 'text-delta', id: '1', delta: ' World' },
                  { type: 'text-end', id: '1' },
                  {
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: {
                      inputTokens: {
                        total: undefined,
                        noCache: undefined,
                        cacheRead: undefined,
                        cacheWrite: undefined,
                      },
                      outputTokens: {
                        total: undefined,
                        text: undefined,
                        reasoning: undefined,
                      },
                    },
                  },
                ]),
              }),
              prompt: 'test-input',
              experimental_transform: stopWordTransform(),
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
                    "id": "1",
                    "type": "text-start",
                  },
                  {
                    "id": "1",
                    "providerMetadata": undefined,
                    "text": "Hello, ",
                    "type": "text-delta",
                  },
                  {
                    "finishReason": "stop",
                    "performance": {
                      "effectiveOutputTokensPerSecond": 0,
                      "effectiveTotalTokensPerSecond": 0,
                      "inputTokensPerSecond": undefined,
                      "outputTokensPerSecond": undefined,
                      "responseTimeMs": 0,
                      "stepTimeMs": 0,
                      "timeToFirstOutputMs": undefined,
                      "toolExecutionMs": {},
                    },
                    "providerMetadata": undefined,
                    "rawFinishReason": undefined,
                    "response": {
                      "id": "response-id",
                      "modelId": "mock-model-id",
                      "timestamp": 1970-01-01T00:00:00.000Z,
                    },
                    "type": "finish-step",
                    "usage": {
                      "inputTokenDetails": {
                        "cacheReadTokens": undefined,
                        "cacheWriteTokens": undefined,
                        "noCacheTokens": undefined,
                      },
                      "inputTokens": undefined,
                      "outputTokenDetails": {
                        "reasoningTokens": undefined,
                        "textTokens": undefined,
                      },
                      "outputTokens": undefined,
                      "raw": undefined,
                      "totalTokens": undefined,
                    },
                  },
                  {
                    "finishReason": "stop",
                    "rawFinishReason": undefined,
                    "totalUsage": {
                      "inputTokenDetails": {
                        "cacheReadTokens": undefined,
                        "cacheWriteTokens": undefined,
                        "noCacheTokens": undefined,
                      },
                      "inputTokens": undefined,
                      "outputTokenDetails": {
                        "reasoningTokens": undefined,
                        "textTokens": undefined,
                      },
                      "outputTokens": undefined,
                      "raw": undefined,
                      "totalTokens": undefined,
                    },
                    "type": "finish",
                  },
                ]
              `);
          },
        });
      });

      it('options.onStepEnd should be called', async () => {
        let result!: Parameters<
          Required<Parameters<typeof streamText>[0]>['onStepEnd']
        >[0];

        const resultObject = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello, ' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          prompt: 'test-input',
          onStepEnd: async event => {
            result = event as unknown as typeof result;
          },
          _internal: {
            generateId: () => 'test-call-id',
            generateCallId: () => 'test-telemetry-call-id',
          },
        });

        await resultObject.consumeStream();

        expect(result.stepNumber).toBe(0);
      });

      it('options.onStepEnd should be preferred over deprecated onStepFinish', async () => {
        const calls: string[] = [];

        const resultObject = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello, ' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          prompt: 'test-input',
          onStepEnd: async () => {
            calls.push('onStepEnd');
          },
          onStepFinish: async () => {
            calls.push('onStepFinish');
          },
        });

        await resultObject.consumeStream();

        expect(calls).toEqual(['onStepEnd']);
      });

      it('options.onStepFinish should be called', async () => {
        await expectUndefinedUnhandledRejections({
          fn: async () => {
            let result!: Parameters<
              Required<Parameters<typeof streamText>[0]>['onStepFinish']
            >[0];

            const resultObject = streamText({
              model: createTestModel({
                stream: convertArrayToReadableStream([
                  { type: 'text-start', id: '1' },
                  { type: 'text-delta', id: '1', delta: 'Hello, ' },
                  { type: 'text-delta', id: '1', delta: 'STOP' },
                  { type: 'text-delta', id: '1', delta: ' World' },
                  { type: 'text-end', id: '1' },
                  {
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: testUsage,
                  },
                ]),
              }),
              prompt: 'test-input',
              onStepFinish: async event => {
                result = event as unknown as typeof result;
              },
              experimental_transform: stopWordTransform(),
              _internal: {
                generateId: () => 'test-call-id',
                generateCallId: () => 'test-telemetry-call-id',
              },
            });

            await resultObject.consumeStream();

            expect(result).toMatchInlineSnapshot(`
              DefaultStepResult {
                "callId": "test-telemetry-call-id",
                "content": [
                  {
                    "providerMetadata": undefined,
                    "text": "Hello, ",
                    "type": "text",
                  },
                ],
                "finishReason": "stop",
                "model": {
                  "modelId": "mock-model-id",
                  "provider": "mock-provider",
                },
                "performance": {
                  "effectiveOutputTokensPerSecond": 0,
                  "effectiveTotalTokensPerSecond": 0,
                  "inputTokensPerSecond": undefined,
                  "outputTokensPerSecond": undefined,
                  "responseTimeMs": 0,
                  "stepTimeMs": 0,
                  "timeToFirstOutputMs": undefined,
                  "toolExecutionMs": {},
                },
                "providerMetadata": undefined,
                "rawFinishReason": undefined,
                "request": {
                  "body": undefined,
                  "messages": undefined,
                },
                "response": {
                  "id": "response-id",
                  "messages": [
                    {
                      "content": [
                        {
                          "providerOptions": undefined,
                          "text": "Hello, ",
                          "type": "text",
                        },
                      ],
                      "role": "assistant",
                    },
                  ],
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "runtimeContext": {},
                "stepNumber": 0,
                "toolsContext": {},
                "usage": {
                  "inputTokenDetails": {
                    "cacheReadTokens": undefined,
                    "cacheWriteTokens": undefined,
                    "noCacheTokens": undefined,
                  },
                  "inputTokens": undefined,
                  "outputTokenDetails": {
                    "reasoningTokens": undefined,
                    "textTokens": undefined,
                  },
                  "outputTokens": undefined,
                  "raw": undefined,
                  "totalTokens": undefined,
                },
                "warnings": [],
              }
            `);
          },
        });
      });
    });
  });

  describe('options.output', () => {
    describe('text output (default)', () => {
      it('should send partial output stream', async () => {
        const result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello, ' },
              { type: 'text-delta', id: '1', delta: 'world!' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          prompt: 'prompt',
        });

        expect(await convertAsyncIterableToArray(result.partialOutputStream))
          .toMatchInlineSnapshot(`
          [
            "Hello, ",
            "Hello, world!",
          ]
        `);
      });

      it('should resolve output promise with the correct content', async () => {
        const result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello, ' },
              { type: 'text-delta', id: '1', delta: 'world!' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          prompt: 'prompt',
        });

        expect(await result.output).toStrictEqual('Hello, world!');
      });
    });

    describe('text output', () => {
      it('should send partial output stream', async () => {
        const result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello, ' },
              { type: 'text-delta', id: '1', delta: 'world!' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          prompt: 'prompt',
          output: Output.text(),
        });

        expect(await convertAsyncIterableToArray(result.partialOutputStream))
          .toMatchInlineSnapshot(`
          [
            "Hello, ",
            "Hello, world!",
          ]
        `);
      });

      it('should not call JSON.stringify for string partial outputs', async () => {
        const originalStringify = JSON.stringify;
        const stringifySpy = vi.spyOn(JSON, 'stringify').mockImplementation(((
          ...args: Parameters<typeof JSON.stringify>
        ) => {
          if (typeof args[0] === 'string') {
            throw new Error(
              'JSON.stringify should not be called for string partial outputs',
            );
          }
          return originalStringify.call(JSON, ...args);
        }) as typeof JSON.stringify);

        try {
          const result = streamText({
            model: createTestModel({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello, ' },
                { type: 'text-delta', id: '1', delta: 'world!' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            }),
            prompt: 'prompt',
            output: Output.text(),
          });

          expect(await convertAsyncIterableToArray(result.partialOutputStream))
            .toMatchInlineSnapshot(`
            [
              "Hello, ",
              "Hello, world!",
            ]
          `);
        } finally {
          stringifySpy.mockRestore();
        }
      });

      it('should resolve output promise with the correct content', async () => {
        const result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello, ' },
              { type: 'text-delta', id: '1', delta: 'world!' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          prompt: 'prompt',
          output: Output.text(),
        });

        expect(await result.output).toStrictEqual('Hello, world!');
      });
    });

    describe('object output', () => {
      it('should set responseFormat to json and send schema as part of the responseFormat', async () => {
        let callOptions!: LanguageModelV4CallOptions;

        const result = streamText({
          model: new MockLanguageModelV4({
            doStream: async args => {
              callOptions = args;
              return {
                stream: convertArrayToReadableStream([
                  { type: 'text-start', id: '1' },
                  { type: 'text-delta', id: '1', delta: '{ ' },
                  { type: 'text-delta', id: '1', delta: '"value": ' },
                  { type: 'text-delta', id: '1', delta: `"Hello, ` },
                  { type: 'text-delta', id: '1', delta: `world` },
                  { type: 'text-delta', id: '1', delta: `!"` },
                  { type: 'text-delta', id: '1', delta: ' }' },
                  { type: 'text-end', id: '1' },
                  {
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: testUsage,
                  },
                ]),
              };
            },
          }),
          output: Output.object({
            schema: z.object({ value: z.string() }),
          }),
          prompt: 'prompt',
        });

        await result.consumeStream();

        expect(callOptions).toMatchInlineSnapshot(`
          {
            "abortSignal": undefined,
            "frequencyPenalty": undefined,
            "headers": undefined,
            "includeRawChunks": false,
            "maxOutputTokens": undefined,
            "presencePenalty": undefined,
            "prompt": [
              {
                "content": [
                  {
                    "text": "prompt",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
            ],
            "providerOptions": undefined,
            "reasoning": undefined,
            "responseFormat": {
              "schema": {
                "$schema": "http://json-schema.org/draft-07/schema#",
                "additionalProperties": false,
                "properties": {
                  "value": {
                    "type": "string",
                  },
                },
                "required": [
                  "value",
                ],
                "type": "object",
              },
              "type": "json",
            },
            "seed": undefined,
            "stopSequences": undefined,
            "temperature": undefined,
            "toolChoice": {
              "type": "auto",
            },
            "tools": undefined,
            "topK": undefined,
            "topP": undefined,
          }
        `);
      });

      it('should send valid partial text fragments', async () => {
        const result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '{ ' },
              { type: 'text-delta', id: '1', delta: '"value": ' },
              { type: 'text-delta', id: '1', delta: `"Hello, ` },
              { type: 'text-delta', id: '1', delta: `world` },
              { type: 'text-delta', id: '1', delta: `!"` },
              { type: 'text-delta', id: '1', delta: ' }' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          output: Output.object({
            schema: z.object({ value: z.string() }),
          }),
          prompt: 'prompt',
        });

        expect(
          await convertAsyncIterableToArray(result.textStream),
        ).toStrictEqual([
          `{ `,
          // key difference: need to combine after `:`
          `"value": "Hello, `,
          `world`,
          `!"`,
          ` }`,
        ]);
      });

      it('should send partial output stream', async () => {
        const result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '{ ' },
              { type: 'text-delta', id: '1', delta: '"value": ' },
              { type: 'text-delta', id: '1', delta: `"Hello, ` },
              { type: 'text-delta', id: '1', delta: `world` },
              { type: 'text-delta', id: '1', delta: `!"` },
              { type: 'text-delta', id: '1', delta: ' }' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          output: Output.object({
            schema: z.object({ value: z.string() }),
          }),
          prompt: 'prompt',
        });

        expect(
          await convertAsyncIterableToArray(result.partialOutputStream),
        ).toStrictEqual([
          {},
          { value: 'Hello, ' },
          { value: 'Hello, world' },
          { value: 'Hello, world!' },
        ]);
      });

      it('should send partial output stream when last chunk contains content', async () => {
        const result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '{ ' },
              { type: 'text-delta', id: '1', delta: '"value": ' },
              { type: 'text-delta', id: '1', delta: `"Hello, ` },
              { type: 'text-delta', id: '1', delta: `world!" }` },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          output: Output.object({
            schema: z.object({ value: z.string() }),
          }),
          prompt: 'prompt',
        });

        expect(
          await convertAsyncIterableToArray(result.partialOutputStream),
        ).toStrictEqual([{}, { value: 'Hello, ' }, { value: 'Hello, world!' }]);
      });

      it('should resolve text promise with the correct content', async () => {
        const result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '{ ' },
              { type: 'text-delta', id: '1', delta: '"value": ' },
              { type: 'text-delta', id: '1', delta: `"Hello, ` },
              { type: 'text-delta', id: '1', delta: `world!" ` },
              { type: 'text-delta', id: '1', delta: '}' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          output: Output.object({
            schema: z.object({ value: z.string() }),
          }),
          prompt: 'prompt',
        });

        expect(await result.text).toStrictEqual('{ "value": "Hello, world!" }');
      });

      it('should resolve output promise with the correct content', async () => {
        const result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '{ ' },
              { type: 'text-delta', id: '1', delta: '"value": ' },
              { type: 'text-delta', id: '1', delta: `"Hello, ` },
              { type: 'text-delta', id: '1', delta: `world!" ` },
              { type: 'text-delta', id: '1', delta: '}' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          output: Output.object({
            schema: z.object({ value: z.string() }),
          }),
          prompt: 'prompt',
        });

        expect(await result.output).toStrictEqual({ value: 'Hello, world!' });
      });

      it('should call onFinish with the correct content', async () => {
        let result!: Parameters<
          Required<Parameters<typeof streamText>[0]>['onFinish']
        >[0];

        const resultObject = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '{ ' },
              { type: 'text-delta', id: '1', delta: '"value": ' },
              { type: 'text-delta', id: '1', delta: `"Hello, ` },
              { type: 'text-delta', id: '1', delta: `world!" ` },
              { type: 'text-delta', id: '1', delta: '}' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          output: Output.object({
            schema: z.object({ value: z.string() }),
          }),
          prompt: 'prompt',
          onFinish: async event => {
            result = event as unknown as typeof result;
          },
          _internal: {
            generateId: mockId({ prefix: 'id' }),
            generateCallId: () => 'test-telemetry-call-id',
          },
        });

        resultObject.consumeStream();

        await resultObject.consumeStream();

        expect(result).toMatchInlineSnapshot(`
          {
            "callId": "test-telemetry-call-id",
            "content": [
              {
                "providerMetadata": undefined,
                "text": "{ "value": "Hello, world!" }",
                "type": "text",
              },
            ],
            "dynamicToolCalls": [],
            "dynamicToolResults": [],
            "files": [],
            "finalStep": DefaultStepResult {
              "callId": "test-telemetry-call-id",
              "content": [
                {
                  "providerMetadata": undefined,
                  "text": "{ "value": "Hello, world!" }",
                  "type": "text",
                },
              ],
              "finishReason": "stop",
              "model": {
                "modelId": "mock-model-id",
                "provider": "mock-provider",
              },
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
              "request": {
                "body": undefined,
                "messages": undefined,
              },
              "response": {
                "headers": undefined,
                "id": "id-0",
                "messages": [
                  {
                    "content": [
                      {
                        "providerOptions": undefined,
                        "text": "{ "value": "Hello, world!" }",
                        "type": "text",
                      },
                    ],
                    "role": "assistant",
                  },
                ],
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "runtimeContext": {},
              "stepNumber": 0,
              "toolsContext": {},
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
              "warnings": [],
            },
            "finishReason": "stop",
            "model": {
              "modelId": "mock-model-id",
              "provider": "mock-provider",
            },
            "providerMetadata": undefined,
            "rawFinishReason": "stop",
            "reasoning": [],
            "reasoningText": undefined,
            "request": {
              "body": undefined,
              "messages": undefined,
            },
            "response": {
              "headers": undefined,
              "id": "id-0",
              "messages": [
                {
                  "content": [
                    {
                      "providerOptions": undefined,
                      "text": "{ "value": "Hello, world!" }",
                      "type": "text",
                    },
                  ],
                  "role": "assistant",
                },
              ],
              "modelId": "mock-model-id",
              "timestamp": 1970-01-01T00:00:00.000Z,
            },
            "responseMessages": [
              {
                "content": [
                  {
                    "providerOptions": undefined,
                    "text": "{ "value": "Hello, world!" }",
                    "type": "text",
                  },
                ],
                "role": "assistant",
              },
            ],
            "runtimeContext": {},
            "sources": [],
            "staticToolCalls": [],
            "staticToolResults": [],
            "stepNumber": 0,
            "steps": [
              DefaultStepResult {
                "callId": "test-telemetry-call-id",
                "content": [
                  {
                    "providerMetadata": undefined,
                    "text": "{ "value": "Hello, world!" }",
                    "type": "text",
                  },
                ],
                "finishReason": "stop",
                "model": {
                  "modelId": "mock-model-id",
                  "provider": "mock-provider",
                },
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
                "request": {
                  "body": undefined,
                  "messages": undefined,
                },
                "response": {
                  "headers": undefined,
                  "id": "id-0",
                  "messages": [
                    {
                      "content": [
                        {
                          "providerOptions": undefined,
                          "text": "{ "value": "Hello, world!" }",
                          "type": "text",
                        },
                      ],
                      "role": "assistant",
                    },
                  ],
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "runtimeContext": {},
                "stepNumber": 0,
                "toolsContext": {},
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
                "warnings": [],
              },
            ],
            "text": "{ "value": "Hello, world!" }",
            "toolCalls": [],
            "toolResults": [],
            "toolsContext": {},
            "totalUsage": {
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
              "totalTokens": 13,
            },
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
              "totalTokens": 13,
            },
            "warnings": [],
          }
        `);
      });
    });

    describe('array output', () => {
      let result: StreamTextResult<any, any, any> | undefined;

      let onFinishResult:
        | Parameters<Required<Parameters<typeof streamText>[0]>['onFinish']>[0]
        | undefined;

      beforeEach(async () => {
        result = undefined;
        onFinishResult = undefined;
      });

      describe('array with 3 elements', () => {
        beforeEach(async () => {
          result = streamText({
            model: createTestModel({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: '{"elements":[' },
                // first element:
                { type: 'text-delta', id: '1', delta: '{' },
                { type: 'text-delta', id: '1', delta: '"content":' },
                { type: 'text-delta', id: '1', delta: `"element 1"` },
                { type: 'text-delta', id: '1', delta: '},' },
                // second element:
                { type: 'text-delta', id: '1', delta: '{ ' },
                { type: 'text-delta', id: '1', delta: '"content": ' },
                { type: 'text-delta', id: '1', delta: `"element 2"` },
                { type: 'text-delta', id: '1', delta: '},' },
                // third element:
                { type: 'text-delta', id: '1', delta: '{' },
                { type: 'text-delta', id: '1', delta: '"content":' },
                { type: 'text-delta', id: '1', delta: `"element 3"` },
                { type: 'text-delta', id: '1', delta: '}' },
                // end of array
                { type: 'text-delta', id: '1', delta: ']' },
                { type: 'text-delta', id: '1', delta: '}' },
                { type: 'text-end', id: '1' },
                // finish
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            }),
            output: Output.array({
              element: z.object({ content: z.string() }),
            }),
            prompt: 'prompt',
            onFinish: async event => {
              onFinishResult = event as unknown as typeof onFinishResult;
            },
          });
        });

        it('should stream only complete objects in partialObjectStream', async () => {
          expect(await convertAsyncIterableToArray(result!.partialOutputStream))
            .toMatchInlineSnapshot(`
            [
              [],
              [
                {
                  "content": "element 1",
                },
              ],
              [
                {
                  "content": "element 1",
                },
                {
                  "content": "element 2",
                },
              ],
              [
                {
                  "content": "element 1",
                },
                {
                  "content": "element 2",
                },
                {
                  "content": "element 3",
                },
              ],
            ]
          `);
        });

        it('should stream individual elements in elementStream', async () => {
          expect(await convertAsyncIterableToArray(result!.elementStream))
            .toMatchInlineSnapshot(`
            [
              {
                "content": "element 1",
              },
              {
                "content": "element 2",
              },
              {
                "content": "element 3",
              },
            ]
          `);
        });

        it('should resolve output promise with the correct content', async () => {
          expect(await result!.output).toStrictEqual([
            { content: 'element 1' },
            { content: 'element 2' },
            { content: 'element 3' },
          ]);
        });

        it('should resolve text promise with the correct text', async () => {
          expect(await result!.text).toMatchInlineSnapshot(
            `"{"elements":[{"content":"element 1"},{ "content": "element 2"},{"content":"element 3"}]}"`,
          );
        });
      });

      describe('array with 2 elements streamed in 1 chunk', () => {
        beforeEach(async () => {
          result = streamText({
            model: createTestModel({
              stream: convertArrayToReadableStream([
                {
                  type: 'text-start',
                  id: '1',
                },
                {
                  type: 'text-delta',
                  id: '1',
                  delta:
                    '{"elements":[{"content":"element 1"},{"content":"element 2"}]}',
                },
                {
                  type: 'text-end',
                  id: '1',
                },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            }),
            output: Output.array({
              element: z.object({ content: z.string() }),
            }),
            prompt: 'prompt',
            onFinish: async event => {
              onFinishResult = event as unknown as typeof onFinishResult;
            },
          });
        });

        it('should stream only complete objects in partialObjectStream', async () => {
          expect(await convertAsyncIterableToArray(result!.partialOutputStream))
            .toMatchInlineSnapshot(`
            [
              [
                {
                  "content": "element 1",
                },
                {
                  "content": "element 2",
                },
              ],
            ]
          `);
        });

        it('should stream individual elements in elementStream', async () => {
          expect(await convertAsyncIterableToArray(result!.elementStream))
            .toMatchInlineSnapshot(`
            [
              {
                "content": "element 1",
              },
              {
                "content": "element 2",
              },
            ]
          `);
        });

        it('should resolve output promise with the correct content', async () => {
          expect(await result!.output).toStrictEqual([
            { content: 'element 1' },
            { content: 'element 2' },
          ]);
        });

        it('should resolve text promise with the correct text', async () => {
          expect(await result!.text).toMatchInlineSnapshot(
            `"{"elements":[{"content":"element 1"},{"content":"element 2"}]}"`,
          );
        });
      });
    });

    describe('choice output', () => {
      it('should stream an choice value', async () => {
        const mockModel = createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '{ ' },
            { type: 'text-delta', id: '1', delta: '"result": ' },
            { type: 'text-delta', id: '1', delta: `"su` },
            { type: 'text-delta', id: '1', delta: `nny` },
            { type: 'text-delta', id: '1', delta: `"` },
            { type: 'text-delta', id: '1', delta: ' }' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        });

        const result = streamText({
          model: mockModel,
          output: Output.choice({
            options: ['sunny', 'rainy', 'snowy'],
          }),
          prompt: 'prompt',
        });

        expect(await convertAsyncIterableToArray(result.partialOutputStream))
          .toMatchInlineSnapshot(`
            [
              "sunny",
            ]
          `);
      });

      it('should resolve text promise with the correct text', async () => {
        const mockModel = createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '{ ' },
            { type: 'text-delta', id: '1', delta: '"result": ' },
            { type: 'text-delta', id: '1', delta: `"su` },
            { type: 'text-delta', id: '1', delta: `nny` },
            { type: 'text-delta', id: '1', delta: `"` },
            { type: 'text-delta', id: '1', delta: ' }' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        });

        const result = streamText({
          model: mockModel,
          output: Output.choice({
            options: ['sunny', 'rainy', 'snowy'],
          }),
          prompt: 'prompt',
        });

        expect(await result.text).toBe('{ "result": "sunny" }');
      });

      it('should resolve output promise with the correct content', async () => {
        const mockModel = createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '{ ' },
            { type: 'text-delta', id: '1', delta: '"result": ' },
            { type: 'text-delta', id: '1', delta: `"su` },
            { type: 'text-delta', id: '1', delta: `nny` },
            { type: 'text-delta', id: '1', delta: `"` },
            { type: 'text-delta', id: '1', delta: ' }' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        });

        const result = streamText({
          model: mockModel,
          output: Output.choice({
            options: ['sunny', 'rainy', 'snowy'],
          }),
          prompt: 'prompt',
        });

        expect(await result.output).toBe('sunny');
      });

      it('should not stream incorrect values', async () => {
        const mockModel = new MockLanguageModelV4({
          doStream: {
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '{ ' },
              { type: 'text-delta', id: '1', delta: '"result": ' },
              { type: 'text-delta', id: '1', delta: `"foo` },
              { type: 'text-delta', id: '1', delta: `bar` },
              { type: 'text-delta', id: '1', delta: `"` },
              { type: 'text-delta', id: '1', delta: ' }' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          },
        });

        const result = streamText({
          model: mockModel,
          output: Output.choice({
            options: ['sunny', 'rainy', 'snowy'],
          }),
          prompt: 'prompt',
        });

        expect(
          await convertAsyncIterableToArray(result.partialOutputStream),
        ).toMatchInlineSnapshot(`[]`);
      });

      it('should handle ambiguous values', async () => {
        const mockModel = createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '{ ' },
            { type: 'text-delta', id: '1', delta: '"result": ' },
            { type: 'text-delta', id: '1', delta: `"foo` },
            { type: 'text-delta', id: '1', delta: `bar` },
            { type: 'text-delta', id: '1', delta: `"` },
            { type: 'text-delta', id: '1', delta: ' }' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        });

        const result = streamText({
          model: mockModel,
          output: Output.choice({
            options: ['foobar', 'foobar2'],
          }),
          prompt: 'prompt',
        });

        expect(await convertAsyncIterableToArray(result.partialOutputStream))
          .toMatchInlineSnapshot(`
          [
            "foobar",
          ]
        `);
      });

      it('should handle non-ambiguous values', async () => {
        const mockModel = createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '{ ' },
            { type: 'text-delta', id: '1', delta: '"result": ' },
            { type: 'text-delta', id: '1', delta: `"foo` },
            { type: 'text-delta', id: '1', delta: `bar` },
            { type: 'text-delta', id: '1', delta: `"` },
            { type: 'text-delta', id: '1', delta: ' }' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        });

        const result = streamText({
          model: mockModel,
          output: Output.choice({
            options: ['foobar', 'barfoo'],
          }),
          prompt: 'prompt',
        });

        expect(await convertAsyncIterableToArray(result.partialOutputStream))
          .toMatchInlineSnapshot(`
          [
            "foobar",
          ]
        `);
      });
    });
  });

  describe('options.activeTools', () => {
    it('should filter available tools to only the ones in activeTools', async () => {
      let tools:
        | (LanguageModelV4FunctionTool | LanguageModelV4ProviderTool)[]
        | undefined;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ tools: toolsArg }) => {
            tools = toolsArg;

            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', ' },
                { type: 'text-delta', id: '1', delta: `world!` },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'result1',
          },
          tool2: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'result2',
          },
        },
        prompt: 'test-input',
        activeTools: ['tool1'],
      });

      await result.consumeStream();

      expect(tools).toMatchInlineSnapshot(`
        [
          {
            "inputSchema": {
              "$schema": "http://json-schema.org/draft-07/schema#",
              "additionalProperties": false,
              "properties": {
                "value": {
                  "type": "string",
                },
              },
              "required": [
                "value",
              ],
              "type": "object",
            },
            "name": "tool1",
            "type": "function",
          },
        ]
      `);
    });
  });

  describe('options.toolOrder', () => {
    it('should order available tools before sending them to the model', async () => {
      let tools:
        | (LanguageModelV4FunctionTool | LanguageModelV4ProviderTool)[]
        | undefined;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ tools: toolsArg }) => {
            tools = toolsArg;

            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        tools: {
          zebra: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'zebra',
          },
          alpha: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'alpha',
          },
          middle: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'middle',
          },
        },
        prompt: 'test-input',
        toolOrder: ['middle'],
      });

      await result.consumeStream();

      expect(tools?.map(tool => tool.name)).toEqual([
        'middle',
        'alpha',
        'zebra',
      ]);
    });
  });

  describe('raw chunks forwarding', () => {
    it('should forward raw chunks when include.rawChunks is enabled', async () => {
      const modelWithRawChunks = createTestModel({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          {
            type: 'raw',
            rawValue: {
              type: 'raw-data',
              content: 'should appear',
            },
          },
          {
            type: 'response-metadata',
            id: 'test-id',
            modelId: 'test-model',
            timestamp: new Date(0),
          },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'Hello, world!' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
          },
        ]),
      });

      const result = streamText({
        model: modelWithRawChunks,
        prompt: 'test prompt',
        include: {
          rawChunks: true,
        },
      });

      const chunks = await convertAsyncIterableToArray(result.stream);

      expect(chunks.filter(chunk => chunk.type === 'raw'))
        .toMatchInlineSnapshot(`
          [
            {
              "rawValue": {
                "content": "should appear",
                "type": "raw-data",
              },
              "type": "raw",
            },
          ]
        `);
    });

    it('should not forward raw chunks when includeRawChunks is disabled', async () => {
      const modelWithRawChunks = createTestModel({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          {
            type: 'raw',
            rawValue: {
              type: 'raw-data',
              content: 'should not appear',
            },
          },
          {
            type: 'response-metadata',
            id: 'test-id',
            modelId: 'test-model',
            timestamp: new Date(0),
          },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'Hello, world!' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
          },
        ]),
      });

      const result = streamText({
        model: modelWithRawChunks,
        prompt: 'test prompt',
        include: {
          rawChunks: false,
        },
      });

      const chunks = await convertAsyncIterableToArray(result.stream);

      expect(chunks.filter(chunk => chunk.type === 'raw')).toHaveLength(0);
    });

    it('should pass through the include.rawChunks flag correctly to the model', async () => {
      let capturedOptions: any;

      const model = new MockLanguageModelV4({
        doStream: async options => {
          capturedOptions = options;

          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          };
        },
      });

      await streamText({
        model,
        prompt: 'test prompt',
        include: {
          rawChunks: true,
        },
      }).consumeStream();

      expect(capturedOptions.includeRawChunks).toBe(true);
    });

    it('should call onChunk with raw chunks when include.rawChunks is enabled', async () => {
      const onChunkCalls: Array<any> = [];

      const modelWithRawChunks = createTestModel({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          {
            type: 'raw',
            rawValue: { type: 'stream-start', data: 'start' },
          },
          {
            type: 'raw',
            rawValue: {
              type: 'response-metadata',
              id: 'test-id',
              modelId: 'test-model',
            },
          },
          {
            type: 'raw',
            rawValue: { type: 'text-delta', content: 'Hello' },
          },
          {
            type: 'raw',
            rawValue: { type: 'text-delta', content: ', world!' },
          },
          {
            type: 'raw',
            rawValue: { type: 'finish', reason: 'stop' },
          },
          {
            type: 'response-metadata',
            id: 'test-id',
            modelId: 'test-model',
            timestamp: new Date(0),
          },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'Hello, world!' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
          },
        ]),
      });

      const result = streamText({
        model: modelWithRawChunks,
        prompt: 'test prompt',
        include: {
          rawChunks: true,
        },
        _internal: {
          generateId: mockId({ prefix: 'id' }),
          generateCallId: () => 'test-telemetry-call-id',
        },
        onChunk({ chunk }) {
          onChunkCalls.push(chunk);
        },
      });

      await result.consumeStream();

      expect(onChunkCalls).toMatchInlineSnapshot(`
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
            "rawValue": {
              "data": "start",
              "type": "stream-start",
            },
            "type": "raw",
          },
          {
            "rawValue": {
              "id": "test-id",
              "modelId": "test-model",
              "type": "response-metadata",
            },
            "type": "raw",
          },
          {
            "rawValue": {
              "content": "Hello",
              "type": "text-delta",
            },
            "type": "raw",
          },
          {
            "rawValue": {
              "content": ", world!",
              "type": "text-delta",
            },
            "type": "raw",
          },
          {
            "rawValue": {
              "reason": "stop",
              "type": "finish",
            },
            "type": "raw",
          },
          {
            "id": "1",
            "type": "text-start",
          },
          {
            "id": "1",
            "providerMetadata": undefined,
            "text": "Hello, world!",
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
              "timeBetweenOutputChunksMs": undefined,
              "timeToFirstOutputMs": 0,
              "toolExecutionMs": {},
            },
            "providerMetadata": undefined,
            "rawFinishReason": "stop",
            "response": {
              "headers": undefined,
              "id": "test-id",
              "modelId": "test-model",
              "timestamp": 1970-01-01T00:00:00.000Z,
            },
            "type": "finish-step",
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
            "finishReason": "stop",
            "rawFinishReason": "stop",
            "totalUsage": {
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
              "totalTokens": 13,
            },
            "type": "finish",
          },
        ]
      `);
    });

    it('should pass includeRawChunks flag correctly to the model', async () => {
      let capturedOptions: any;

      const model = new MockLanguageModelV4({
        doStream: async options => {
          capturedOptions = options;
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'response-metadata',
                id: 'test-id',
                modelId: 'test-model',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          };
        },
      });

      await streamText({
        model,
        prompt: 'test prompt',
        include: {
          rawChunks: true,
        },
      }).consumeStream();

      expect(capturedOptions.includeRawChunks).toBe(true);

      await streamText({
        model,
        prompt: 'test prompt',
        include: {
          rawChunks: false,
        },
      }).consumeStream();

      expect(capturedOptions.includeRawChunks).toBe(false);

      await streamText({
        model,
        prompt: 'test prompt',
      }).consumeStream();

      expect(capturedOptions.includeRawChunks).toBe(false);
    });

    it('should use deprecated includeRawChunks as fallback', async () => {
      let capturedOptions: any;

      const model = new MockLanguageModelV4({
        doStream: async options => {
          capturedOptions = options;
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          };
        },
      });

      await streamText({
        model,
        prompt: 'test prompt',
        includeRawChunks: true,
      }).consumeStream();

      expect(capturedOptions.includeRawChunks).toBe(true);
    });

    it('should prefer include.rawChunks over deprecated includeRawChunks', async () => {
      let capturedOptions: any;

      const model = new MockLanguageModelV4({
        doStream: async options => {
          capturedOptions = options;
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          };
        },
      });

      await streamText({
        model,
        prompt: 'test prompt',
        include: {
          rawChunks: false,
        },
        includeRawChunks: true,
      }).consumeStream();

      expect(capturedOptions.includeRawChunks).toBe(false);
    });

    it('should accept deprecated experimental_include as an alias for include', async () => {
      let capturedOptions: any;

      const model = new MockLanguageModelV4({
        doStream: async options => {
          capturedOptions = options;
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          };
        },
      });

      await streamText({
        model,
        prompt: 'test prompt',
        experimental_include: {
          rawChunks: true,
        },
      }).consumeStream();

      expect(capturedOptions.includeRawChunks).toBe(true);
    });

    it('should prefer include.rawChunks over deprecated experimental_include.rawChunks', async () => {
      let capturedOptions: any;

      const model = new MockLanguageModelV4({
        doStream: async options => {
          capturedOptions = options;
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          };
        },
      });

      await streamText({
        model,
        prompt: 'test prompt',
        include: {
          rawChunks: false,
        },
        experimental_include: {
          rawChunks: true,
        },
      }).consumeStream();

      expect(capturedOptions.includeRawChunks).toBe(false);
    });
  });

  describe('mixed multi content streaming with interleaving parts', () => {
    describe('mixed text and reasoning blocks', () => {
      let result: StreamTextResult<any, any, any>;

      beforeEach(async () => {
        result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'reasoning-start', id: '0' },
              { type: 'text-start', id: '1' },
              { type: 'reasoning-delta', id: '0', delta: 'Thinking...' },
              { type: 'text-delta', id: '1', delta: 'Hello' },
              { type: 'text-delta', id: '1', delta: ', ' },
              { type: 'text-start', id: '2' },
              { type: 'text-delta', id: '2', delta: `This ` },
              { type: 'text-delta', id: '2', delta: `is ` },
              { type: 'reasoning-start', id: '3' },
              { type: 'reasoning-delta', id: '0', delta: `I'm thinking...` },
              { type: 'reasoning-delta', id: '3', delta: `Separate thoughts` },
              { type: 'text-delta', id: '2', delta: `a` },
              { type: 'text-delta', id: '1', delta: `world!` },
              { type: 'reasoning-end', id: '0' },
              { type: 'text-delta', id: '2', delta: ` test.` },
              { type: 'text-end', id: '2' },
              { type: 'reasoning-end', id: '3' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          prompt: 'test-input',
          _internal: {
            generateId: mockId(),
            generateCallId: () => 'test-telemetry-call-id',
          },
        });
      });

      it('should return the full stream with the correct parts', async () => {
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
                "type": "reasoning-start",
              },
              {
                "id": "1",
                "type": "text-start",
              },
              {
                "id": "0",
                "providerMetadata": undefined,
                "text": "Thinking...",
                "type": "reasoning-delta",
              },
              {
                "id": "1",
                "providerMetadata": undefined,
                "text": "Hello",
                "type": "text-delta",
              },
              {
                "id": "1",
                "providerMetadata": undefined,
                "text": ", ",
                "type": "text-delta",
              },
              {
                "id": "2",
                "type": "text-start",
              },
              {
                "id": "2",
                "providerMetadata": undefined,
                "text": "This ",
                "type": "text-delta",
              },
              {
                "id": "2",
                "providerMetadata": undefined,
                "text": "is ",
                "type": "text-delta",
              },
              {
                "id": "3",
                "type": "reasoning-start",
              },
              {
                "id": "0",
                "providerMetadata": undefined,
                "text": "I'm thinking...",
                "type": "reasoning-delta",
              },
              {
                "id": "3",
                "providerMetadata": undefined,
                "text": "Separate thoughts",
                "type": "reasoning-delta",
              },
              {
                "id": "2",
                "providerMetadata": undefined,
                "text": "a",
                "type": "text-delta",
              },
              {
                "id": "1",
                "providerMetadata": undefined,
                "text": "world!",
                "type": "text-delta",
              },
              {
                "id": "0",
                "type": "reasoning-end",
              },
              {
                "id": "2",
                "providerMetadata": undefined,
                "text": " test.",
                "type": "text-delta",
              },
              {
                "id": "2",
                "type": "text-end",
              },
              {
                "id": "3",
                "type": "reasoning-end",
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
                  "id": "id-0",
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "type": "finish-step",
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
                "finishReason": "stop",
                "rawFinishReason": "stop",
                "totalUsage": {
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
                  "totalTokens": 13,
                },
                "type": "finish",
              },
            ]
          `);
      });

      it('should return the content parts in the correct order', async () => {
        expect(await result.content).toMatchInlineSnapshot(`
          [
            {
              "providerMetadata": undefined,
              "text": "Thinking...I'm thinking...",
              "type": "reasoning",
            },
            {
              "providerMetadata": undefined,
              "text": "Hello, world!",
              "type": "text",
            },
            {
              "providerMetadata": undefined,
              "text": "This is a test.",
              "type": "text",
            },
            {
              "providerMetadata": undefined,
              "text": "Separate thoughts",
              "type": "reasoning",
            },
          ]
        `);
      });

      it('should return the step content parts in the correct order', async () => {
        expect(await result.steps).toMatchInlineSnapshot(`
          [
            DefaultStepResult {
              "callId": "test-telemetry-call-id",
              "content": [
                {
                  "providerMetadata": undefined,
                  "text": "Thinking...I'm thinking...",
                  "type": "reasoning",
                },
                {
                  "providerMetadata": undefined,
                  "text": "Hello, world!",
                  "type": "text",
                },
                {
                  "providerMetadata": undefined,
                  "text": "This is a test.",
                  "type": "text",
                },
                {
                  "providerMetadata": undefined,
                  "text": "Separate thoughts",
                  "type": "reasoning",
                },
              ],
              "finishReason": "stop",
              "model": {
                "modelId": "mock-model-id",
                "provider": "mock-provider",
              },
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
              "request": {
                "body": undefined,
                "messages": undefined,
              },
              "response": {
                "headers": undefined,
                "id": "id-0",
                "messages": [
                  {
                    "content": [
                      {
                        "providerOptions": undefined,
                        "text": "Thinking...I'm thinking...",
                        "type": "reasoning",
                      },
                      {
                        "providerOptions": undefined,
                        "text": "Hello, world!",
                        "type": "text",
                      },
                      {
                        "providerOptions": undefined,
                        "text": "This is a test.",
                        "type": "text",
                      },
                      {
                        "providerOptions": undefined,
                        "text": "Separate thoughts",
                        "type": "reasoning",
                      },
                    ],
                    "role": "assistant",
                  },
                ],
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "runtimeContext": {},
              "stepNumber": 0,
              "toolsContext": {},
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
              "warnings": [],
            },
          ]
        `);
      });
    });
  });

  describe('abort signal', () => {
    describe('basic abort', () => {
      let result: StreamTextResult<ToolSet, any, never>;
      let onErrorCalls: Array<{ error: unknown }> = [];
      let onAbortCalls: Array<{ steps: StepResult<ToolSet, any>[] }> = [];
      let telemetryCalls: Array<{ name: string; event?: unknown }> = [];

      beforeEach(() => {
        onErrorCalls = [];
        onAbortCalls = [];
        telemetryCalls = [];

        const abortController = new AbortController();
        let pullCalls = 0;
        const telemetryIntegration: Telemetry = {
          onAbort: event => {
            telemetryCalls.push({ name: 'onAbort', event });
          },
          onEnd: event => {
            telemetryCalls.push({ name: 'onEnd', event });
          },
          onError: event => {
            telemetryCalls.push({ name: 'onError', event });
          },
        };

        result = streamText({
          abortSignal: abortController.signal,
          onError: error => {
            onErrorCalls.push({ error });
          },
          onAbort: event => {
            onAbortCalls.push(event);
          },
          telemetry: {
            integrations: telemetryIntegration,
          },
          _internal: {
            generateCallId: () => 'test-telemetry-call-id',
          },
          model: new MockLanguageModelV4({
            doStream: async () => ({
              stream: new ReadableStream({
                pull(controller) {
                  switch (pullCalls++) {
                    case 0:
                      controller.enqueue({
                        type: 'stream-start',
                        warnings: [],
                      });
                      break;
                    case 1:
                      controller.enqueue({
                        type: 'text-start',
                        id: '1',
                      });
                      break;
                    case 2:
                      controller.enqueue({
                        type: 'text-delta',
                        id: '1',
                        delta: 'Hello',
                      });
                      break;
                    case 3:
                      abortController.abort();
                      controller.error(
                        new DOMException(
                          'The user aborted a request.',
                          'AbortError',
                        ),
                      );
                      break;
                  }
                },
              }),
            }),
          }),
          prompt: 'test-input',
        });
      });

      it('should not call onError for abort errors', async () => {
        await result.consumeStream();
        expect(onErrorCalls).toMatchInlineSnapshot(`[]`);
      });

      it('should call onAbort when the abort signal is triggered', async () => {
        await result.consumeStream();
        expect(onAbortCalls).toMatchInlineSnapshot(`
          [
            {
              "callId": "test-telemetry-call-id",
              "reason": [AbortError: This operation was aborted],
              "steps": [],
            },
          ]
        `);
      });

      it('should call telemetry onAbort but not onEnd or onError when the abort signal is triggered', async () => {
        await result.consumeStream();
        expect(
          telemetryCalls.map(({ name, event }) => ({
            name,
            steps: (event as { steps?: unknown[] }).steps,
          })),
        ).toMatchInlineSnapshot(`
          [
            {
              "name": "onAbort",
              "steps": [],
            },
          ]
        `);
      });

      it.skipIf(isNodeVersionAtLeast(24, 15))(
        'should only stream initial chunks in full stream',
        async () => {
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
                  "reason": "AbortError: This operation was aborted",
                  "type": "abort",
                },
              ]
            `);
        },
      );

      it.skipIf(isNodeVersionAtLeast(24, 15))(
        'should sent an abort chunk in the ui message stream',
        async () => {
          expect(await convertAsyncIterableToArray(result.toUIMessageStream()))
            .toMatchInlineSnapshot(`
              [
                {
                  "type": "start",
                },
                {
                  "type": "start-step",
                },
                {
                  "reason": "AbortError: This operation was aborted",
                  "type": "abort",
                },
              ]
            `);
        },
      );

      it('should include abort reason when provided', async () => {
        const abortController = new AbortController();
        let pullCalls = 0;

        const resultWithReason = streamText({
          abortSignal: abortController.signal,
          model: new MockLanguageModelV4({
            doStream: async () => ({
              stream: new ReadableStream({
                pull(controller) {
                  switch (pullCalls++) {
                    case 0:
                      controller.enqueue({
                        type: 'stream-start',
                        warnings: [],
                      });
                      break;
                    case 1:
                      abortController.abort('manual abort');
                      controller.error(
                        new DOMException(
                          'The user aborted a request.',
                          'AbortError',
                        ),
                      );
                      break;
                  }
                },
              }),
            }),
          }),
          prompt: 'test-input',
        });

        expect(await convertAsyncIterableToArray(resultWithReason.stream))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "start",
              },
              {
                "reason": "manual abort",
                "type": "abort",
              },
            ]
          `);

        expect(
          await convertAsyncIterableToArray(
            resultWithReason.toUIMessageStream(),
          ),
        ).toMatchInlineSnapshot(`
          [
            {
              "type": "start",
            },
            {
              "reason": "manual abort",
              "type": "abort",
            },
          ]
        `);
      });
    });

    describe('abort in 2nd step', () => {
      let result: StreamTextResult<any, any, never>;
      let onErrorCalls: Array<{ error: unknown }> = [];
      let onAbortCalls: Array<{ steps: StepResult<any, any>[] }> = [];

      beforeEach(() => {
        onErrorCalls = [];
        onAbortCalls = [];

        const abortController = new AbortController();
        let pullCalls = 0;
        let streamCalls = 0;

        result = streamText({
          abortSignal: abortController.signal,
          onAbort: event => {
            onAbortCalls.push(event);
          },
          model: new MockLanguageModelV4({
            doStream: async () => ({
              stream: new ReadableStream({
                start(controller) {
                  streamCalls++;
                  pullCalls = 0;
                },
                pull(controller) {
                  if (streamCalls === 1) {
                    switch (pullCalls++) {
                      case 0:
                        controller.enqueue({
                          type: 'stream-start',
                          warnings: [],
                        });
                        break;
                      case 1:
                        controller.enqueue({
                          type: 'tool-call',
                          toolCallId: 'call-1',
                          toolName: 'tool1',
                          input: `{ "value": "value" }`,
                        });
                        break;
                      case 2:
                        controller.enqueue({
                          type: 'finish',
                          finishReason: {
                            unified: 'tool-calls',
                            raw: undefined,
                          },
                          usage: testUsage,
                        });
                        controller.close();
                        break;
                    }
                  } else
                    switch (pullCalls++) {
                      case 0:
                        controller.enqueue({
                          type: 'stream-start',
                          warnings: [],
                        });
                        break;
                      case 1:
                        controller.enqueue({
                          type: 'text-start',
                          id: '1',
                        });
                        break;
                      case 2:
                        controller.enqueue({
                          type: 'text-delta',
                          id: '1',
                          delta: 'Hello',
                        });
                        break;
                      case 3:
                        abortController.abort();
                        controller.error(
                          new DOMException(
                            'The user aborted a request.',
                            'AbortError',
                          ),
                        );
                        break;
                    }
                },
              }),
            }),
          }),
          tools: {
            tool1: {
              inputSchema: z.object({ value: z.string() }),
              execute: async () => 'result1',
            },
          },
          stopWhen: isStepCount(3),
          ...defaultSettings(),
          onError: error => {
            onErrorCalls.push({ error });
          },
        });
      });

      it('should not call onError for abort errors', async () => {
        await result.consumeStream();
        expect(onErrorCalls).toMatchInlineSnapshot(`[]`);
      });

      it('should call onAbort when the abort signal is triggered', async () => {
        await result.consumeStream();
        expect(onAbortCalls).toMatchInlineSnapshot(`
          [
            {
              "callId": "test-telemetry-call-id",
              "reason": [AbortError: This operation was aborted],
              "steps": [
                DefaultStepResult {
                  "callId": "test-telemetry-call-id",
                  "content": [
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "providerMetadata": undefined,
                      "title": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                    {
                      "dynamic": false,
                      "input": {
                        "value": "value",
                      },
                      "output": "result1",
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "finishReason": "tool-calls",
                  "model": {
                    "modelId": "mock-model-id",
                    "provider": "mock-provider",
                  },
                  "performance": {
                    "effectiveOutputTokensPerSecond": 0,
                    "effectiveTotalTokensPerSecond": 0,
                    "inputTokensPerSecond": 0,
                    "outputTokensPerSecond": 0,
                    "responseTimeMs": 0,
                    "stepTimeMs": 0,
                    "timeBetweenOutputChunksMs": undefined,
                    "timeToFirstOutputMs": 0,
                    "toolExecutionMs": {
                      "call-1": 0,
                    },
                  },
                  "providerMetadata": undefined,
                  "rawFinishReason": undefined,
                  "request": {
                    "body": undefined,
                    "messages": undefined,
                  },
                  "response": {
                    "headers": undefined,
                    "id": "id-0",
                    "messages": [
                      {
                        "content": [
                          {
                            "input": {
                              "value": "value",
                            },
                            "providerExecuted": undefined,
                            "providerOptions": undefined,
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-call",
                          },
                        ],
                        "role": "assistant",
                      },
                      {
                        "content": [
                          {
                            "output": {
                              "type": "text",
                              "value": "result1",
                            },
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-result",
                          },
                        ],
                        "role": "tool",
                      },
                    ],
                    "modelId": "mock-model-id",
                    "timestamp": 1970-01-01T00:00:00.000Z,
                  },
                  "runtimeContext": {},
                  "stepNumber": 0,
                  "toolsContext": {},
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
                  "warnings": [],
                },
              ],
            },
          ]
        `);
      });

      it('should only stream initial chunks in full stream', async () => {
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
                "input": {
                  "value": "value",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
              {
                "dynamic": false,
                "input": {
                  "value": "value",
                },
                "output": "result1",
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-result",
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
                  "timeBetweenOutputChunksMs": undefined,
                  "timeToFirstOutputMs": 0,
                  "toolExecutionMs": {
                    "call-1": 0,
                  },
                },
                "providerMetadata": undefined,
                "rawFinishReason": undefined,
                "response": {
                  "headers": undefined,
                  "id": "id-0",
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "type": "finish-step",
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
                "reason": "AbortError: This operation was aborted",
                "type": "abort",
              },
            ]
          `);
      });

      it('should sent an abort chunk in the ui message stream', async () => {
        expect(await convertAsyncIterableToArray(result.toUIMessageStream()))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "start",
              },
              {
                "type": "start-step",
              },
              {
                "input": {
                  "value": "value",
                },
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-input-available",
              },
              {
                "output": "result1",
                "toolCallId": "call-1",
                "type": "tool-output-available",
              },
              {
                "type": "finish-step",
              },
              {
                "reason": "AbortError: This operation was aborted",
                "type": "abort",
              },
            ]
          `);
      });
    });

    describe('abort during tool execution', () => {
      let result: StreamTextResult<any, any, never>;
      let onErrorCalls: Array<{ error: unknown }> = [];
      let onAbortCalls: Array<{ steps: StepResult<any, any>[] }> = [];

      beforeEach(() => {
        onErrorCalls = [];
        onAbortCalls = [];

        const abortController = new AbortController();
        let pullCalls = 0;
        let streamCalls = 0;

        result = streamText({
          ...defaultSettings(),
          abortSignal: abortController.signal,
          onError: error => {
            onErrorCalls.push({ error });
          },
          onAbort: event => {
            onAbortCalls.push(event);
          },
          model: new MockLanguageModelV4({
            doStream: async () => ({
              stream: new ReadableStream({
                start(controller) {
                  streamCalls++;
                  pullCalls = 0;
                },
                pull(controller) {
                  if (streamCalls === 1) {
                    switch (pullCalls++) {
                      case 0:
                        controller.enqueue({
                          type: 'stream-start',
                          warnings: [],
                        });
                        break;
                      case 1:
                        controller.enqueue({
                          type: 'tool-call',
                          toolCallId: 'call-1',
                          toolName: 'tool1',
                          input: `{ "value": "value" }`,
                        });
                        break;
                      case 2:
                        controller.enqueue({
                          type: 'finish',
                          finishReason: {
                            unified: 'tool-calls',
                            raw: undefined,
                          },
                          usage: testUsage,
                        });
                        controller.close();
                        break;
                    }
                  } else
                    switch (pullCalls++) {
                      case 0:
                        controller.enqueue({
                          type: 'stream-start',
                          warnings: [],
                        });
                        break;
                      case 1:
                        controller.enqueue({
                          type: 'text-start',
                          id: '1',
                        });
                        break;
                      case 2:
                        controller.enqueue({
                          type: 'text-delta',
                          id: '1',
                          delta: 'Hello',
                        });
                        break;
                      case 3:
                        controller.enqueue({
                          type: 'text-end',
                          id: '1',
                        });
                        controller.enqueue({
                          type: 'finish',
                          finishReason: {
                            unified: 'tool-calls',
                            raw: undefined,
                          },
                          usage: testUsage,
                        });
                        controller.close();
                        break;
                    }
                },
              }),
            }),
          }),
          tools: {
            tool1: {
              inputSchema: z.object({ value: z.string() }),
              execute: async () => {
                abortController.abort();
                return 'result1';
              },
            },
          },
          stopWhen: isStepCount(3),
        });
      });

      it('should not call onError for abort errors', async () => {
        await result.consumeStream();
        expect(onErrorCalls).toMatchInlineSnapshot(`[]`);
      });

      it('should call onAbort when the abort signal is triggered during tool call', async () => {
        await result.consumeStream();
        expect(onAbortCalls).toMatchInlineSnapshot(`
          [
            {
              "callId": "test-telemetry-call-id",
              "reason": [AbortError: This operation was aborted],
              "steps": [],
            },
          ]
        `);
      });

      it('should end full stream with abort part', async () => {
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
                "input": {
                  "value": "value",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
              {
                "reason": "AbortError: This operation was aborted",
                "type": "abort",
              },
            ]
          `);
      });
    });
  });

  describe('context', () => {
    it('should send context to tool execution', async () => {
      let recordedContext: unknown | undefined;

      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'tool-input-start',
              id: 'call-1',
              toolName: 'web_search',
              providerExecuted: true,
            },
            {
              type: 'tool-input-delta',
              id: 'call-1',
              delta: '{ "value": "value" }',
            },
            {
              type: 'tool-input-end',
              id: 'call-1',
            },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 't1',
              input: `{ "value": "value" }`,
            },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        tools: {
          t1: tool({
            inputSchema: z.object({ value: z.string() }),
            contextSchema: z.object({ context: z.string() }),
            execute: async ({ value }, { context }) => {
              recordedContext = context;
              return { value: 'test-result' };
            },
          }),
        },
        toolsContext: {
          t1: {
            context: 'test',
          },
        },
        prompt: 'test-input',
      });

      await result.consumeStream();

      // tool should be executed by client
      expect(recordedContext).toStrictEqual({
        context: 'test',
      });
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
      let recordedSandbox: SandboxSession | undefined;

      const result = streamText({
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 't1',
              input: `{ "value": "value" }`,
            },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
        tools: {
          t1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }, { experimental_sandbox: sandbox }) => {
              recordedSandbox = sandbox;
              return { value };
            },
          }),
        },
        experimental_sandbox: sandbox,
        prompt: 'test-input',
      });

      await result.consumeStream();

      expect(recordedSandbox).toBe(sandbox);
    });

    it('should pass runtimeContext to prepareStep', async () => {
      let capturedContext: unknown;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
            response: {},
          }),
        }),
        runtimeContext: { myData: 'test-value' },
        prepareStep: async ({ runtimeContext }) => {
          capturedContext = runtimeContext;
          return undefined;
        },
        prompt: 'test',
      });

      await result.consumeStream();
      expect(capturedContext).toEqual({ myData: 'test-value' });
    });

    it('should pass sandbox to prepareStep', async () => {
      const sandbox = {
        description: 'test sandbox',
        run: vi.fn(async () => ({
          exitCode: 0,
          stdout: 'ok',
          stderr: '',
        })),
        ...mockSandboxSessionFileStubs,
      } satisfies SandboxSession;
      let capturedSandbox: SandboxSession | undefined;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
            response: {},
          }),
        }),
        experimental_sandbox: sandbox,
        prepareStep: async ({ experimental_sandbox: sandbox }) => {
          capturedSandbox = sandbox;
          return undefined;
        },
        prompt: 'test',
      });

      await result.consumeStream();

      expect(capturedSandbox).toBe(sandbox);
    });

    it('should use sandbox returned from prepareStep for that step only', async () => {
      const sandbox = {
        description: 'default sandbox',
        run: vi.fn(async () => ({
          exitCode: 0,
          stdout: 'ok',
          stderr: '',
        })),
        ...mockSandboxSessionFileStubs,
      } satisfies SandboxSession;
      const stepSandbox = {
        description: 'step sandbox',
        run: vi.fn(async () => ({
          exitCode: 0,
          stdout: 'ok',
          stderr: '',
        })),
        ...mockSandboxSessionFileStubs,
      } satisfies SandboxSession;
      const recordedSandboxes: Array<SandboxSession | undefined> = [];
      let responseCount = 0;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'tool-call',
                      toolCallId: 'call-1',
                      toolName: 't1',
                      input: `{ "value": "first" }`,
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'tool-calls', raw: undefined },
                      usage: testUsage,
                    },
                  ]),
                };
              case 1:
                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'tool-call',
                      toolCallId: 'call-2',
                      toolName: 't1',
                      input: `{ "value": "second" }`,
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'tool-calls', raw: undefined },
                      usage: testUsage,
                    },
                  ]),
                };
              default:
                return {
                  stream: convertArrayToReadableStream([
                    { type: 'text-start', id: '1' },
                    { type: 'text-delta', id: '1', delta: 'done' },
                    { type: 'text-end', id: '1' },
                    {
                      type: 'finish',
                      finishReason: { unified: 'stop', raw: 'stop' },
                      usage: testUsage,
                    },
                  ]),
                };
            }
          },
        }),
        tools: {
          t1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }, { experimental_sandbox: sandbox }) => {
              recordedSandboxes.push(sandbox);
              return { value };
            },
          }),
        },
        experimental_sandbox: sandbox,
        prepareStep: async ({ stepNumber }) =>
          stepNumber === 0 ? { experimental_sandbox: stepSandbox } : {},
        prompt: 'test-input',
        stopWhen: isStepCount(3),
      });

      await result.consumeStream();

      expect(recordedSandboxes).toEqual([stepSandbox, sandbox]);
    });

    it('should send runtimeContext in onFinish callback', async () => {
      let recordedContext: unknown | undefined;

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello, ' },
              { type: 'text-delta', id: '1', delta: 'world!' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
        }),
        runtimeContext: {
          context: 'test',
        },
        prompt: 'test-input',
        onFinish: ({ runtimeContext }) => {
          recordedContext = runtimeContext;
        },
      });

      await result.consumeStream();

      expect(recordedContext).toStrictEqual({
        context: 'test',
      });
    });
  });

  describe('invalid tool calls', () => {
    describe('single invalid tool call', () => {
      let result: StreamTextResult<any, any, any>;

      beforeEach(async () => {
        result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'tool-input-start',
                id: 'call-1',
                toolName: 'cityAttractions',
              },
              {
                type: 'tool-input-delta',
                id: 'call-1',
                delta: `{ "cities": "San Francisco" }`,
              },
              {
                type: 'tool-input-end',
                id: 'call-1',
              },
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'cityAttractions',
                // wrong tool call arguments (city vs cities):
                input: `{ "cities": "San Francisco" }`,
              },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          prompt: 'test-input',
          _internal: {
            generateId: mockId(),
            generateCallId: () => 'test-telemetry-call-id',
          },
          tools: {
            cityAttractions: tool({
              inputSchema: z.object({ city: z.string() }),
            }),
          },
        });
      });

      it('should add tool call and result error parts to the content', async () => {
        expect(await result.content).toMatchInlineSnapshot(`
          [
            {
              "dynamic": true,
              "error": [AI_InvalidToolInputError: Invalid input for tool cityAttractions: AI_TypeValidationError: Type validation failed: Value: {"cities":"San Francisco"}.
          Error message: [
            {
              "expected": "string",
              "code": "invalid_type",
              "path": [
                "city"
              ],
              "message": "Invalid input: expected string, received undefined"
            }
          ]],
              "input": {
                "cities": "San Francisco",
              },
              "invalid": true,
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "cityAttractions",
              "type": "tool-call",
            },
            {
              "dynamic": true,
              "error": "AI_InvalidToolInputError: Invalid input for tool cityAttractions: AI_TypeValidationError: Type validation failed: Value: {"cities":"San Francisco"}.
          Error message: [
            {
              "expected": "string",
              "code": "invalid_type",
              "path": [
                "city"
              ],
              "message": "Invalid input: expected string, received undefined"
            }
          ]",
              "input": {
                "cities": "San Francisco",
              },
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "cityAttractions",
              "type": "tool-error",
            },
          ]
        `);
      });

      it('should add tool call and result error parts to the full stream', async () => {
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
                "dynamic": false,
                "id": "call-1",
                "title": undefined,
                "toolName": "cityAttractions",
                "type": "tool-input-start",
              },
              {
                "delta": "{ "cities": "San Francisco" }",
                "id": "call-1",
                "type": "tool-input-delta",
              },
              {
                "id": "call-1",
                "type": "tool-input-end",
              },
              {
                "dynamic": true,
                "error": [AI_InvalidToolInputError: Invalid input for tool cityAttractions: AI_TypeValidationError: Type validation failed: Value: {"cities":"San Francisco"}.
            Error message: [
              {
                "expected": "string",
                "code": "invalid_type",
                "path": [
                  "city"
                ],
                "message": "Invalid input: expected string, received undefined"
              }
            ]],
                "input": {
                  "cities": "San Francisco",
                },
                "invalid": true,
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "cityAttractions",
                "type": "tool-call",
              },
              {
                "dynamic": true,
                "error": "AI_InvalidToolInputError: Invalid input for tool cityAttractions: AI_TypeValidationError: Type validation failed: Value: {"cities":"San Francisco"}.
            Error message: [
              {
                "expected": "string",
                "code": "invalid_type",
                "path": [
                  "city"
                ],
                "message": "Invalid input: expected string, received undefined"
              }
            ]",
                "input": {
                  "cities": "San Francisco",
                },
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "cityAttractions",
                "type": "tool-error",
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
                  "id": "id-0",
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "type": "finish-step",
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
                "finishReason": "stop",
                "rawFinishReason": "stop",
                "totalUsage": {
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
                  "totalTokens": 13,
                },
                "type": "finish",
              },
            ]
          `);
      });

      it('should add tool call and result error parts to the ui message stream', async () => {
        expect(await convertAsyncIterableToArray(result.toUIMessageStream()))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "start",
              },
              {
                "type": "start-step",
              },
              {
                "toolCallId": "call-1",
                "toolName": "cityAttractions",
                "type": "tool-input-start",
              },
              {
                "inputTextDelta": "{ "cities": "San Francisco" }",
                "toolCallId": "call-1",
                "type": "tool-input-delta",
              },
              {
                "errorText": "An error occurred.",
                "input": {
                  "cities": "San Francisco",
                },
                "toolCallId": "call-1",
                "toolName": "cityAttractions",
                "type": "tool-input-error",
              },
              {
                "errorText": "An error occurred.",
                "toolCallId": "call-1",
                "type": "tool-output-error",
              },
              {
                "type": "finish-step",
              },
              {
                "finishReason": "stop",
                "type": "finish",
              },
            ]
          `);
      });
    });
  });

  describe('tools with preliminary results', () => {
    describe('single tool with preliminary results', () => {
      let result: StreamTextResult<any, any, any>;

      beforeEach(async () => {
        result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'cityAttractions',
                input: `{ "city": "San Francisco" }`,
              },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          prompt: 'test-input',
          _internal: {
            generateId: mockId(),
            generateCallId: () => 'test-telemetry-call-id',
          },
          tools: {
            cityAttractions: tool({
              inputSchema: z.object({ city: z.string() }),
              async *execute({ city }) {
                yield {
                  status: 'loading',
                  text: `Getting weather for ${city}`,
                };

                yield {
                  status: 'success',
                  text: `The weather in ${city} is 72°F`,
                  temperature: 72,
                };
              },
            }),
          },
        });
      });

      it('should include preliminary tool results in full stream', async () => {
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
                "input": {
                  "city": "San Francisco",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "cityAttractions",
                "type": "tool-call",
              },
              {
                "input": {
                  "city": "San Francisco",
                },
                "output": {
                  "status": "loading",
                  "text": "Getting weather for San Francisco",
                },
                "preliminary": true,
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "cityAttractions",
                "type": "tool-result",
              },
              {
                "input": {
                  "city": "San Francisco",
                },
                "output": {
                  "status": "success",
                  "temperature": 72,
                  "text": "The weather in San Francisco is 72°F",
                },
                "preliminary": true,
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "cityAttractions",
                "type": "tool-result",
              },
              {
                "dynamic": false,
                "input": {
                  "city": "San Francisco",
                },
                "output": {
                  "status": "success",
                  "temperature": 72,
                  "text": "The weather in San Francisco is 72°F",
                },
                "toolCallId": "call-1",
                "toolName": "cityAttractions",
                "type": "tool-result",
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
                  "toolExecutionMs": {
                    "call-1": 0,
                  },
                },
                "providerMetadata": undefined,
                "rawFinishReason": "stop",
                "response": {
                  "headers": undefined,
                  "id": "id-0",
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "type": "finish-step",
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
                "finishReason": "stop",
                "rawFinishReason": "stop",
                "totalUsage": {
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
                  "totalTokens": 13,
                },
                "type": "finish",
              },
            ]
          `);
      });

      it('should include preliminary tool results in ui message stream', async () => {
        expect(await convertAsyncIterableToArray(result.toUIMessageStream()))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "start",
              },
              {
                "type": "start-step",
              },
              {
                "input": {
                  "city": "San Francisco",
                },
                "toolCallId": "call-1",
                "toolName": "cityAttractions",
                "type": "tool-input-available",
              },
              {
                "output": {
                  "status": "loading",
                  "text": "Getting weather for San Francisco",
                },
                "preliminary": true,
                "toolCallId": "call-1",
                "type": "tool-output-available",
              },
              {
                "output": {
                  "status": "success",
                  "temperature": 72,
                  "text": "The weather in San Francisco is 72°F",
                },
                "preliminary": true,
                "toolCallId": "call-1",
                "type": "tool-output-available",
              },
              {
                "output": {
                  "status": "success",
                  "temperature": 72,
                  "text": "The weather in San Francisco is 72°F",
                },
                "toolCallId": "call-1",
                "type": "tool-output-available",
              },
              {
                "type": "finish-step",
              },
              {
                "finishReason": "stop",
                "type": "finish",
              },
            ]
          `);
      });

      it('should only include final tool result in content', async () => {
        expect(await result.content).toMatchInlineSnapshot(`
          [
            {
              "input": {
                "city": "San Francisco",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "cityAttractions",
              "type": "tool-call",
            },
            {
              "dynamic": false,
              "input": {
                "city": "San Francisco",
              },
              "output": {
                "status": "success",
                "temperature": 72,
                "text": "The weather in San Francisco is 72°F",
              },
              "toolCallId": "call-1",
              "toolName": "cityAttractions",
              "type": "tool-result",
            },
          ]
        `);
      });

      it('should only include final tool result in step content', async () => {
        expect(await result.steps).toMatchInlineSnapshot(`
          [
            DefaultStepResult {
              "callId": "test-telemetry-call-id",
              "content": [
                {
                  "input": {
                    "city": "San Francisco",
                  },
                  "providerExecuted": undefined,
                  "providerMetadata": undefined,
                  "title": undefined,
                  "toolCallId": "call-1",
                  "toolName": "cityAttractions",
                  "type": "tool-call",
                },
                {
                  "dynamic": false,
                  "input": {
                    "city": "San Francisco",
                  },
                  "output": {
                    "status": "success",
                    "temperature": 72,
                    "text": "The weather in San Francisco is 72°F",
                  },
                  "toolCallId": "call-1",
                  "toolName": "cityAttractions",
                  "type": "tool-result",
                },
              ],
              "finishReason": "stop",
              "model": {
                "modelId": "mock-model-id",
                "provider": "mock-provider",
              },
              "performance": {
                "effectiveOutputTokensPerSecond": 0,
                "effectiveTotalTokensPerSecond": 0,
                "inputTokensPerSecond": 0,
                "outputTokensPerSecond": 0,
                "responseTimeMs": 0,
                "stepTimeMs": 0,
                "timeBetweenOutputChunksMs": undefined,
                "timeToFirstOutputMs": 0,
                "toolExecutionMs": {
                  "call-1": 0,
                },
              },
              "providerMetadata": undefined,
              "rawFinishReason": "stop",
              "request": {
                "body": undefined,
                "messages": undefined,
              },
              "response": {
                "headers": undefined,
                "id": "id-0",
                "messages": [
                  {
                    "content": [
                      {
                        "input": {
                          "city": "San Francisco",
                        },
                        "providerExecuted": undefined,
                        "providerOptions": undefined,
                        "toolCallId": "call-1",
                        "toolName": "cityAttractions",
                        "type": "tool-call",
                      },
                    ],
                    "role": "assistant",
                  },
                  {
                    "content": [
                      {
                        "output": {
                          "type": "json",
                          "value": {
                            "status": "success",
                            "temperature": 72,
                            "text": "The weather in San Francisco is 72°F",
                          },
                        },
                        "toolCallId": "call-1",
                        "toolName": "cityAttractions",
                        "type": "tool-result",
                      },
                    ],
                    "role": "tool",
                  },
                ],
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "runtimeContext": {},
              "stepNumber": 0,
              "toolsContext": {},
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
              "warnings": [],
            },
          ]
        `);
      });
    });
  });

  describe('provider-executed dynamic tools', () => {
    describe('single provider-executed dynamic tool with input streaming', () => {
      let result: StreamTextResult<any, any, any>;

      beforeEach(async () => {
        result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'tool-input-start',
                id: 'call-1',
                toolName: 'cityAttractions',
                providerExecuted: true,
                dynamic: true,
                providerMetadata: {
                  anthropic: {
                    serverName: 'echo',
                  },
                },
              },
              {
                type: 'tool-input-delta',
                id: 'call-1',
                delta: `{ "city": "San Francisco" }`,
              },
              {
                type: 'tool-input-end',
                id: 'call-1',
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'cityAttractions',
                input: `{ "city": "San Francisco" }`,
                providerExecuted: true,
                dynamic: true,
                providerMetadata: {
                  anthropic: {
                    serverName: 'echo',
                  },
                },
              },
              {
                type: 'tool-result',
                toolCallId: 'call-1',
                toolName: 'cityAttractions',
                input: `{ "city": "San Francisco" }`,
                result: {
                  status: 'success',
                  text: 'The weather in San Francisco is 72°F',
                },
                providerExecuted: true,
                dynamic: true,
                providerMetadata: {
                  anthropic: {
                    serverName: 'echo',
                  },
                },
              },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          prompt: 'test-input',
          _internal: {
            generateId: mockId(),
            generateCallId: () => 'test-telemetry-call-id',
          },
        });
      });

      it('should set dynamic and providerExecuted in full stream', async () => {
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
                "dynamic": true,
                "id": "call-1",
                "providerExecuted": true,
                "providerMetadata": {
                  "anthropic": {
                    "serverName": "echo",
                  },
                },
                "title": undefined,
                "toolName": "cityAttractions",
                "type": "tool-input-start",
              },
              {
                "delta": "{ "city": "San Francisco" }",
                "id": "call-1",
                "type": "tool-input-delta",
              },
              {
                "id": "call-1",
                "type": "tool-input-end",
              },
              {
                "dynamic": true,
                "input": {
                  "city": "San Francisco",
                },
                "providerExecuted": true,
                "providerMetadata": {
                  "anthropic": {
                    "serverName": "echo",
                  },
                },
                "toolCallId": "call-1",
                "toolName": "cityAttractions",
                "type": "tool-call",
              },
              {
                "dynamic": true,
                "input": {
                  "city": "San Francisco",
                },
                "output": {
                  "status": "success",
                  "text": "The weather in San Francisco is 72°F",
                },
                "providerExecuted": true,
                "providerMetadata": {
                  "anthropic": {
                    "serverName": "echo",
                  },
                },
                "toolCallId": "call-1",
                "toolName": "cityAttractions",
                "type": "tool-result",
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
                  "id": "id-0",
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "type": "finish-step",
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
                "finishReason": "stop",
                "rawFinishReason": "stop",
                "totalUsage": {
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
                  "totalTokens": 13,
                },
                "type": "finish",
              },
            ]
          `);
      });

      it('should set dynamic and providerExecuted in ui message stream', async () => {
        expect(await convertAsyncIterableToArray(result.toUIMessageStream()))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "start",
              },
              {
                "type": "start-step",
              },
              {
                "dynamic": true,
                "providerExecuted": true,
                "providerMetadata": {
                  "anthropic": {
                    "serverName": "echo",
                  },
                },
                "toolCallId": "call-1",
                "toolName": "cityAttractions",
                "type": "tool-input-start",
              },
              {
                "inputTextDelta": "{ "city": "San Francisco" }",
                "toolCallId": "call-1",
                "type": "tool-input-delta",
              },
              {
                "dynamic": true,
                "input": {
                  "city": "San Francisco",
                },
                "providerExecuted": true,
                "providerMetadata": {
                  "anthropic": {
                    "serverName": "echo",
                  },
                },
                "toolCallId": "call-1",
                "toolName": "cityAttractions",
                "type": "tool-input-available",
              },
              {
                "dynamic": true,
                "output": {
                  "status": "success",
                  "text": "The weather in San Francisco is 72°F",
                },
                "providerExecuted": true,
                "providerMetadata": {
                  "anthropic": {
                    "serverName": "echo",
                  },
                },
                "toolCallId": "call-1",
                "type": "tool-output-available",
              },
              {
                "type": "finish-step",
              },
              {
                "finishReason": "stop",
                "type": "finish",
              },
            ]
          `);
      });

      it('should set dynamic and providerExecuted in content', async () => {
        expect(await result.content).toMatchInlineSnapshot(`
          [
            {
              "dynamic": true,
              "input": {
                "city": "San Francisco",
              },
              "providerExecuted": true,
              "providerMetadata": {
                "anthropic": {
                  "serverName": "echo",
                },
              },
              "toolCallId": "call-1",
              "toolName": "cityAttractions",
              "type": "tool-call",
            },
            {
              "dynamic": true,
              "input": {
                "city": "San Francisco",
              },
              "output": {
                "status": "success",
                "text": "The weather in San Francisco is 72°F",
              },
              "providerExecuted": true,
              "providerMetadata": {
                "anthropic": {
                  "serverName": "echo",
                },
              },
              "toolCallId": "call-1",
              "toolName": "cityAttractions",
              "type": "tool-result",
            },
          ]
        `);
      });
    });
  });

  describe('programmatic tool calling', () => {
    describe('5 steps: code_execution triggers client tool across multiple turns (dice game fixture)', () => {
      let result: StreamTextResult<any, any, any>;
      let onFinishResult: Parameters<GenerateTextOnEndCallback<any, any>>[0];
      let onStepFinishResults: StepResult<any, any>[];
      let doStreamCalls: Array<LanguageModelV4CallOptions>;
      let prepareStepCalls: Array<{
        modelId: string;
        stepNumber: number;
        steps: Array<StepResult<any, any>>;
        messages: Array<ModelMessage>;
      }>;
      let rollDieExecutions: Array<{ player: string }>;

      // Fixture-based tool call IDs (from anthropic-programmatic-tool-calling.1.chunks.txt)
      const CODE_EXEC_ID = 'srvtoolu_01MzSrFWsmzBdcoQkGWLyRjK';
      const CONTAINER_ID = 'container_011CWHPPTDTn1XufeRB9uHeH';

      beforeEach(async () => {
        onFinishResult = undefined as any;
        onStepFinishResults = [];
        doStreamCalls = [];
        prepareStepCalls = [];
        rollDieExecutions = [];

        let responseCount = 0;

        result = streamText({
          model: new MockLanguageModelV4({
            doStream: async options => {
              doStreamCalls.push(options);

              switch (responseCount++) {
                case 0:
                  // Step 1: text + server_tool_use (code_execution) + rollDie call
                  return {
                    stream: convertArrayToReadableStream([
                      {
                        type: 'response-metadata',
                        id: 'msg_01ERcBqAvLTHWQDk9c9qJLWC',
                        modelId: 'claude-sonnet-4-5-20250929',
                        timestamp: new Date(0),
                      },
                      { type: 'text-start', id: '1' },
                      {
                        type: 'text-delta',
                        id: '1',
                        delta:
                          "I'll help you simulate this game between two players where one is using a loaded die.",
                      },
                      { type: 'text-end', id: '1' },
                      {
                        type: 'tool-call',
                        toolCallId: CODE_EXEC_ID,
                        toolName: 'code_execution',
                        input: `{"type":"programmatic-tool-call","code":"game_loop()"}`,
                        providerExecuted: true,
                      },
                      {
                        type: 'tool-call',
                        toolCallId: 'toolu_019jKkXz4jAdwHweHBw92CVY',
                        toolName: 'rollDie',
                        input: `{ "player": "player1" }`,
                      },
                      {
                        type: 'finish',
                        finishReason: { unified: 'tool-calls', raw: undefined },
                        usage: {
                          inputTokens: {
                            total: 3369,
                            noCache: 3369,
                            cacheRead: undefined,
                            cacheWrite: undefined,
                          },
                          outputTokens: {
                            total: 725,
                            text: 725,
                            reasoning: undefined,
                          },
                        },
                        providerMetadata: {
                          anthropic: {
                            container: { id: CONTAINER_ID },
                          },
                        },
                      },
                    ]),
                    response: { headers: { call: '1' } },
                  };

                case 1:
                  // Step 2: rollDie call (player2)
                  return {
                    stream: convertArrayToReadableStream([
                      {
                        type: 'response-metadata',
                        id: 'msg_01KSVw3xmXbMNJPNMt46BC5W',
                        modelId: 'claude-sonnet-4-5-20250929',
                        timestamp: new Date(1000),
                      },
                      {
                        type: 'tool-call',
                        toolCallId: 'toolu_015dGLMbwBKv1ZRQr6KdJzeH',
                        toolName: 'rollDie',
                        input: `{ "player": "player2" }`,
                      },
                      {
                        type: 'finish',
                        finishReason: { unified: 'tool-calls', raw: undefined },
                        usage: {
                          inputTokens: {
                            total: 0,
                            noCache: 0,
                            cacheRead: undefined,
                            cacheWrite: undefined,
                          },
                          outputTokens: {
                            total: 0,
                            text: 0,
                            reasoning: undefined,
                          },
                        },
                        providerMetadata: {
                          anthropic: {
                            container: { id: CONTAINER_ID },
                          },
                        },
                      },
                    ]),
                    response: { headers: { call: '2' } },
                  };

                case 2:
                  // Step 3: rollDie calls (round 2)
                  return {
                    stream: convertArrayToReadableStream([
                      {
                        type: 'response-metadata',
                        id: 'msg_016fLapHzDx8DG2SUcsGKyPA',
                        modelId: 'claude-sonnet-4-5-20250929',
                        timestamp: new Date(2000),
                      },
                      {
                        type: 'tool-call',
                        toolCallId: 'toolu_01YYqBNq5mk1wMtv3PAqY44m',
                        toolName: 'rollDie',
                        input: `{ "player": "player1" }`,
                      },
                      {
                        type: 'finish',
                        finishReason: { unified: 'tool-calls', raw: undefined },
                        usage: {
                          inputTokens: {
                            total: 0,
                            noCache: 0,
                            cacheRead: undefined,
                            cacheWrite: undefined,
                          },
                          outputTokens: {
                            total: 0,
                            text: 0,
                            reasoning: undefined,
                          },
                        },
                        providerMetadata: {
                          anthropic: {
                            container: { id: CONTAINER_ID },
                          },
                        },
                      },
                    ]),
                    response: { headers: { call: '3' } },
                  };

                case 3:
                  // Step 4: more rollDie calls
                  return {
                    stream: convertArrayToReadableStream([
                      {
                        type: 'response-metadata',
                        id: 'msg_01MQHz6AzmwmZoTry5nk5EQC',
                        modelId: 'claude-sonnet-4-5-20250929',
                        timestamp: new Date(3000),
                      },
                      {
                        type: 'tool-call',
                        toolCallId: 'toolu_018WxjDkQG8h7i63poySGT2x',
                        toolName: 'rollDie',
                        input: `{ "player": "player2" }`,
                      },
                      {
                        type: 'finish',
                        finishReason: { unified: 'tool-calls', raw: undefined },
                        usage: {
                          inputTokens: {
                            total: 0,
                            noCache: 0,
                            cacheRead: undefined,
                            cacheWrite: undefined,
                          },
                          outputTokens: {
                            total: 0,
                            text: 0,
                            reasoning: undefined,
                          },
                        },
                        providerMetadata: {
                          anthropic: {
                            container: { id: CONTAINER_ID },
                          },
                        },
                      },
                    ]),
                    response: { headers: { call: '4' } },
                  };

                case 4:
                  // Step 5: code_execution_tool_result + final text
                  return {
                    stream: convertArrayToReadableStream([
                      {
                        type: 'response-metadata',
                        id: 'msg_01CfmDducyrt61n4Q7QS8VFK',
                        modelId: 'claude-sonnet-4-5-20250929',
                        timestamp: new Date(4000),
                      },
                      {
                        type: 'tool-result',
                        toolCallId: CODE_EXEC_ID,
                        toolName: 'code_execution',
                        result: {
                          type: 'code_execution_result',
                          stdout:
                            '=== DICE GAME: First to 3 Wins ===\n\n--- Round 1 ---\nPlayer 1 rolls: 5\nPlayer 2 rolls: 6\nPlayer 2 wins this round!\nScore: Player 1 = 0, Player 2 = 1\n\n--- Round 2 ---\nPlayer 1 rolls: 4\nPlayer 2 rolls: 6\nPlayer 2 wins this round!\nScore: Player 1 = 0, Player 2 = 2\n\n--- Round 3 ---\nPlayer 1 rolls: 5\nPlayer 2 rolls: 2\nPlayer 1 wins this round!\nScore: Player 1 = 1, Player 2 = 2\n\n--- Round 4 ---\nPlayer 1 rolls: 6\nPlayer 2 rolls: 6\nDraw! No one gets a point.\nScore: Player 1 = 1, Player 2 = 2\n\n--- Round 5 ---\nPlayer 1 rolls: 3\nPlayer 2 rolls: 2\nPlayer 1 wins this round!\nScore: Player 1 = 2, Player 2 = 2\n\n--- Round 6 ---\nPlayer 1 rolls: 6\nPlayer 2 rolls: 6\nDraw! No one gets a point.\nScore: Player 1 = 2, Player 2 = 2\n\n--- Round 7 ---\nPlayer 1 rolls: 2\nPlayer 2 rolls: 3\nPlayer 2 wins this round!\nScore: Player 1 = 2, Player 2 = 3\n\n========================================\n🏆 GAME OVER: Player 2 wins the game! (3-2)\n========================================\n\n📊 Analysis:\nTotal rounds played: 7\nPlayer 2 had better results - likely using the loaded die! 🎲\n',
                          stderr: '',
                          return_code: 0,
                          content: [],
                        },
                        providerExecuted: true,
                      },
                      { type: 'text-start', id: '2' },
                      {
                        type: 'text-delta',
                        id: '2',
                        delta:
                          '## Game Results\n\n**Player 2 wins the game 3-2!** 🏆\n\nThe game lasted 7 rounds with the following breakdown:\n- **Player 1**: 2 round wins\n- **Player 2**: 3 round wins\n- **Draws**: 2 rounds (both rolling 6)\n\nBased on the results, **Player 2 appears to be the one using the loaded die**.',
                      },
                      { type: 'text-end', id: '2' },
                      {
                        type: 'finish',
                        finishReason: { unified: 'stop', raw: 'stop' },
                        usage: {
                          inputTokens: {
                            total: 4551,
                            noCache: 4551,
                            cacheRead: undefined,
                            cacheWrite: undefined,
                          },
                          outputTokens: {
                            total: 197,
                            text: 197,
                            reasoning: undefined,
                          },
                        },
                      },
                    ]),
                    response: { headers: { call: '5' } },
                  };

                default:
                  throw new Error(
                    `Unexpected response count: ${responseCount}`,
                  );
              }
            },
          }),
          tools: {
            code_execution: {
              type: 'provider',
              isProviderExecuted: true,
              id: 'anthropic.code_execution_20250825',
              inputSchema: z.object({ code: z.string() }),
              outputSchema: z.object({
                stdout: z.string(),
                stderr: z.string(),
              }),
              args: {},
              supportsDeferredResults: true,
            },
            rollDie: tool({
              description: 'Roll a die and return the result.',
              inputSchema: z.object({
                player: z.enum(['player1', 'player2']),
              }),
              execute: async ({ player }) => {
                rollDieExecutions.push({ player });
                return player === 'player1' ? 6 : 3;
              },
              providerOptions: {
                anthropic: {
                  allowedCallers: ['code_execution_20250825'],
                },
              },
            }),
          },
          prompt: 'Play a dice game between two players.',
          stopWhen: isStepCount(10),
          onFinish: async event => {
            onFinishResult = event as unknown as typeof onFinishResult;
          },
          onStepFinish: async event => {
            onStepFinishResults.push(event);
          },
          prepareStep: async ({ model, stepNumber, steps, messages }) => {
            prepareStepCalls.push({
              modelId: typeof model === 'string' ? model : model.modelId,
              stepNumber,
              steps: [...steps],
              messages: [...messages],
            });

            // Forward container ID from previous step (simulating forwardAnthropicContainerIdFromLastStep)
            if (stepNumber > 0 && steps.length > 0) {
              const lastStep = steps[steps.length - 1];
              const containerId = (
                lastStep.providerMetadata?.anthropic as
                  | { container?: { id?: string } }
                  | undefined
              )?.container?.id;

              if (containerId) {
                return {
                  providerOptions: {
                    anthropic: {
                      container: { id: containerId },
                    },
                  },
                };
              }
            }
            return undefined;
          },
        });
      });

      describe('step inputs', () => {
        it('should send correct prompt in step 1', async () => {
          await result.consumeStream();
          expect(doStreamCalls[0].prompt).toMatchInlineSnapshot(`
            [
              {
                "content": [
                  {
                    "text": "Play a dice game between two players.",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
            ]
          `);
        });

        it('should send correct tools in step 1', async () => {
          await result.consumeStream();
          expect(doStreamCalls[0].tools).toMatchInlineSnapshot(`
            [
              {
                "args": {},
                "id": "anthropic.code_execution_20250825",
                "name": "code_execution",
                "type": "provider",
              },
              {
                "description": "Roll a die and return the result.",
                "inputSchema": {
                  "$schema": "http://json-schema.org/draft-07/schema#",
                  "additionalProperties": false,
                  "properties": {
                    "player": {
                      "enum": [
                        "player1",
                        "player2",
                      ],
                      "type": "string",
                    },
                  },
                  "required": [
                    "player",
                  ],
                  "type": "object",
                },
                "name": "rollDie",
                "providerOptions": {
                  "anthropic": {
                    "allowedCallers": [
                      "code_execution_20250825",
                    ],
                  },
                },
                "type": "function",
              },
            ]
          `);
        });

        it('should include assistant messages and tool results in step 2 prompt', async () => {
          await result.consumeStream();
          expect(doStreamCalls[1].prompt).toMatchInlineSnapshot(`
            [
              {
                "content": [
                  {
                    "text": "Play a dice game between two players.",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
              {
                "content": [
                  {
                    "providerOptions": undefined,
                    "text": "I'll help you simulate this game between two players where one is using a loaded die.",
                    "type": "text",
                  },
                  {
                    "input": {
                      "code": "game_loop()",
                    },
                    "providerExecuted": true,
                    "providerOptions": undefined,
                    "toolCallId": "srvtoolu_01MzSrFWsmzBdcoQkGWLyRjK",
                    "toolName": "code_execution",
                    "type": "tool-call",
                  },
                  {
                    "input": {
                      "player": "player1",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "toolu_019jKkXz4jAdwHweHBw92CVY",
                    "toolName": "rollDie",
                    "type": "tool-call",
                  },
                ],
                "providerOptions": undefined,
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "json",
                      "value": 6,
                    },
                    "providerOptions": undefined,
                    "toolCallId": "toolu_019jKkXz4jAdwHweHBw92CVY",
                    "toolName": "rollDie",
                    "type": "tool-result",
                  },
                ],
                "providerOptions": undefined,
                "role": "tool",
              },
            ]
          `);
        });

        it('should include all previous messages in step 3 prompt (round 2)', async () => {
          await result.consumeStream();
          expect(doStreamCalls[2].prompt).toMatchInlineSnapshot(`
            [
              {
                "content": [
                  {
                    "text": "Play a dice game between two players.",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
              {
                "content": [
                  {
                    "providerOptions": undefined,
                    "text": "I'll help you simulate this game between two players where one is using a loaded die.",
                    "type": "text",
                  },
                  {
                    "input": {
                      "code": "game_loop()",
                    },
                    "providerExecuted": true,
                    "providerOptions": undefined,
                    "toolCallId": "srvtoolu_01MzSrFWsmzBdcoQkGWLyRjK",
                    "toolName": "code_execution",
                    "type": "tool-call",
                  },
                  {
                    "input": {
                      "player": "player1",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "toolu_019jKkXz4jAdwHweHBw92CVY",
                    "toolName": "rollDie",
                    "type": "tool-call",
                  },
                ],
                "providerOptions": undefined,
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "json",
                      "value": 6,
                    },
                    "providerOptions": undefined,
                    "toolCallId": "toolu_019jKkXz4jAdwHweHBw92CVY",
                    "toolName": "rollDie",
                    "type": "tool-result",
                  },
                ],
                "providerOptions": undefined,
                "role": "tool",
              },
              {
                "content": [
                  {
                    "input": {
                      "player": "player2",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "toolu_015dGLMbwBKv1ZRQr6KdJzeH",
                    "toolName": "rollDie",
                    "type": "tool-call",
                  },
                ],
                "providerOptions": undefined,
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "json",
                      "value": 3,
                    },
                    "providerOptions": undefined,
                    "toolCallId": "toolu_015dGLMbwBKv1ZRQr6KdJzeH",
                    "toolName": "rollDie",
                    "type": "tool-result",
                  },
                ],
                "providerOptions": undefined,
                "role": "tool",
              },
            ]
          `);
        });

        it('should forward container ID via providerOptions in step 2', async () => {
          await result.consumeStream();
          expect(doStreamCalls[1].providerOptions).toMatchInlineSnapshot(`
            {
              "anthropic": {
                "container": {
                  "id": "container_011CWHPPTDTn1XufeRB9uHeH",
                },
              },
            }
          `);
        });

        it('should include all previous messages in step 5 prompt (final step)', async () => {
          await result.consumeStream();
          expect(doStreamCalls[4].prompt).toMatchSnapshot();
        });
      });

      describe('result.responseMessages', () => {
        it('should contain response messages from all steps', async () => {
          await result.consumeStream();
          expect(await result.responseMessages).toMatchInlineSnapshot(`
            [
              {
                "content": [
                  {
                    "providerOptions": undefined,
                    "text": "I'll help you simulate this game between two players where one is using a loaded die.",
                    "type": "text",
                  },
                  {
                    "input": {
                      "code": "game_loop()",
                    },
                    "providerExecuted": true,
                    "providerOptions": undefined,
                    "toolCallId": "srvtoolu_01MzSrFWsmzBdcoQkGWLyRjK",
                    "toolName": "code_execution",
                    "type": "tool-call",
                  },
                  {
                    "input": {
                      "player": "player1",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "toolu_019jKkXz4jAdwHweHBw92CVY",
                    "toolName": "rollDie",
                    "type": "tool-call",
                  },
                ],
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "json",
                      "value": 6,
                    },
                    "toolCallId": "toolu_019jKkXz4jAdwHweHBw92CVY",
                    "toolName": "rollDie",
                    "type": "tool-result",
                  },
                ],
                "role": "tool",
              },
              {
                "content": [
                  {
                    "input": {
                      "player": "player2",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "toolu_015dGLMbwBKv1ZRQr6KdJzeH",
                    "toolName": "rollDie",
                    "type": "tool-call",
                  },
                ],
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "json",
                      "value": 3,
                    },
                    "toolCallId": "toolu_015dGLMbwBKv1ZRQr6KdJzeH",
                    "toolName": "rollDie",
                    "type": "tool-result",
                  },
                ],
                "role": "tool",
              },
              {
                "content": [
                  {
                    "input": {
                      "player": "player1",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "toolu_01YYqBNq5mk1wMtv3PAqY44m",
                    "toolName": "rollDie",
                    "type": "tool-call",
                  },
                ],
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "json",
                      "value": 6,
                    },
                    "toolCallId": "toolu_01YYqBNq5mk1wMtv3PAqY44m",
                    "toolName": "rollDie",
                    "type": "tool-result",
                  },
                ],
                "role": "tool",
              },
              {
                "content": [
                  {
                    "input": {
                      "player": "player2",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "toolu_018WxjDkQG8h7i63poySGT2x",
                    "toolName": "rollDie",
                    "type": "tool-call",
                  },
                ],
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "json",
                      "value": 3,
                    },
                    "toolCallId": "toolu_018WxjDkQG8h7i63poySGT2x",
                    "toolName": "rollDie",
                    "type": "tool-result",
                  },
                ],
                "role": "tool",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "json",
                      "value": {
                        "content": [],
                        "return_code": 0,
                        "stderr": "",
                        "stdout": "=== DICE GAME: First to 3 Wins ===

            --- Round 1 ---
            Player 1 rolls: 5
            Player 2 rolls: 6
            Player 2 wins this round!
            Score: Player 1 = 0, Player 2 = 1

            --- Round 2 ---
            Player 1 rolls: 4
            Player 2 rolls: 6
            Player 2 wins this round!
            Score: Player 1 = 0, Player 2 = 2

            --- Round 3 ---
            Player 1 rolls: 5
            Player 2 rolls: 2
            Player 1 wins this round!
            Score: Player 1 = 1, Player 2 = 2

            --- Round 4 ---
            Player 1 rolls: 6
            Player 2 rolls: 6
            Draw! No one gets a point.
            Score: Player 1 = 1, Player 2 = 2

            --- Round 5 ---
            Player 1 rolls: 3
            Player 2 rolls: 2
            Player 1 wins this round!
            Score: Player 1 = 2, Player 2 = 2

            --- Round 6 ---
            Player 1 rolls: 6
            Player 2 rolls: 6
            Draw! No one gets a point.
            Score: Player 1 = 2, Player 2 = 2

            --- Round 7 ---
            Player 1 rolls: 2
            Player 2 rolls: 3
            Player 2 wins this round!
            Score: Player 1 = 2, Player 2 = 3

            ========================================
            🏆 GAME OVER: Player 2 wins the game! (3-2)
            ========================================

            📊 Analysis:
            Total rounds played: 7
            Player 2 had better results - likely using the loaded die! 🎲
            ",
                        "type": "code_execution_result",
                      },
                    },
                    "providerOptions": undefined,
                    "toolCallId": "srvtoolu_01MzSrFWsmzBdcoQkGWLyRjK",
                    "toolName": "code_execution",
                    "type": "tool-result",
                  },
                  {
                    "providerOptions": undefined,
                    "text": "## Game Results

            **Player 2 wins the game 3-2!** 🏆

            The game lasted 7 rounds with the following breakdown:
            - **Player 1**: 2 round wins
            - **Player 2**: 3 round wins
            - **Draws**: 2 rounds (both rolling 6)

            Based on the results, **Player 2 appears to be the one using the loaded die**.",
                    "type": "text",
                  },
                ],
                "role": "assistant",
              },
            ]
          `);
        });
      });

      describe('result.toolCalls and result.toolResults', () => {
        it('should return toolCalls from all steps', async () => {
          expect((await result.toolCalls).map(toolCall => toolCall.toolCallId))
            .toMatchInlineSnapshot(`
              [
                "srvtoolu_01MzSrFWsmzBdcoQkGWLyRjK",
                "toolu_019jKkXz4jAdwHweHBw92CVY",
                "toolu_015dGLMbwBKv1ZRQr6KdJzeH",
                "toolu_01YYqBNq5mk1wMtv3PAqY44m",
                "toolu_018WxjDkQG8h7i63poySGT2x",
              ]
            `);
        });

        it('should return empty finalStep.toolCalls when final step has no tool calls', async () => {
          expect((await result.finalStep).toolCalls).toMatchInlineSnapshot(
            `[]`,
          );
        });

        it('should return toolResults from all steps', async () => {
          expect(
            (await result.toolResults).map(toolResult => toolResult.toolCallId),
          ).toMatchInlineSnapshot(`
              [
                "toolu_019jKkXz4jAdwHweHBw92CVY",
                "toolu_015dGLMbwBKv1ZRQr6KdJzeH",
                "toolu_01YYqBNq5mk1wMtv3PAqY44m",
                "toolu_018WxjDkQG8h7i63poySGT2x",
                "srvtoolu_01MzSrFWsmzBdcoQkGWLyRjK",
              ]
            `);
        });

        it('should return final step toolResults from finalStep', async () => {
          expect((await result.finalStep).toolResults).toMatchInlineSnapshot(`
            [
              {
                "dynamic": undefined,
                "input": undefined,
                "output": {
                  "content": [],
                  "return_code": 0,
                  "stderr": "",
                  "stdout": "=== DICE GAME: First to 3 Wins ===

            --- Round 1 ---
            Player 1 rolls: 5
            Player 2 rolls: 6
            Player 2 wins this round!
            Score: Player 1 = 0, Player 2 = 1

            --- Round 2 ---
            Player 1 rolls: 4
            Player 2 rolls: 6
            Player 2 wins this round!
            Score: Player 1 = 0, Player 2 = 2

            --- Round 3 ---
            Player 1 rolls: 5
            Player 2 rolls: 2
            Player 1 wins this round!
            Score: Player 1 = 1, Player 2 = 2

            --- Round 4 ---
            Player 1 rolls: 6
            Player 2 rolls: 6
            Draw! No one gets a point.
            Score: Player 1 = 1, Player 2 = 2

            --- Round 5 ---
            Player 1 rolls: 3
            Player 2 rolls: 2
            Player 1 wins this round!
            Score: Player 1 = 2, Player 2 = 2

            --- Round 6 ---
            Player 1 rolls: 6
            Player 2 rolls: 6
            Draw! No one gets a point.
            Score: Player 1 = 2, Player 2 = 2

            --- Round 7 ---
            Player 1 rolls: 2
            Player 2 rolls: 3
            Player 2 wins this round!
            Score: Player 1 = 2, Player 2 = 3

            ========================================
            🏆 GAME OVER: Player 2 wins the game! (3-2)
            ========================================

            📊 Analysis:
            Total rounds played: 7
            Player 2 had better results - likely using the loaded die! 🎲
            ",
                  "type": "code_execution_result",
                },
                "providerExecuted": true,
                "toolCallId": "srvtoolu_01MzSrFWsmzBdcoQkGWLyRjK",
                "toolName": "code_execution",
                "type": "tool-result",
              },
            ]
          `);
        });
      });

      describe('tool execution', () => {
        it('should execute rollDie tool 4 times (twice per step for steps 1 and 2)', async () => {
          await result.consumeStream();
          expect(rollDieExecutions).toMatchInlineSnapshot(`
            [
              {
                "player": "player1",
              },
              {
                "player": "player2",
              },
              {
                "player": "player1",
              },
              {
                "player": "player2",
              },
            ]
          `);
        });
      });

      describe('result.steps', () => {
        it('should contain 5 steps', async () => {
          expect((await result.steps).length).toBe(5);
        });

        it('should have correct finishReason for each step', async () => {
          const steps = await result.steps;
          expect(steps[0].finishReason).toBe('tool-calls');
          expect(steps[1].finishReason).toBe('tool-calls');
          expect(steps[2].finishReason).toBe('tool-calls');
          expect(steps[3].finishReason).toBe('tool-calls');
          expect(steps[4].finishReason).toBe('stop');
        });
      });

      describe('result.text', () => {
        it('should return final text from last step', async () => {
          expect(await result.text).toContain('Game Results');
        });
      });

      describe('result.finishReason', () => {
        it('should return stop from final step', async () => {
          expect(await result.finishReason).toBe('stop');
        });
      });

      describe('result.totalUsage', () => {
        it('should sum token usage across all steps', async () => {
          await result.consumeStream();
          expect(await result.totalUsage).toMatchInlineSnapshot(`
            {
              "inputTokenDetails": {
                "cacheReadTokens": undefined,
                "cacheWriteTokens": undefined,
                "noCacheTokens": 7920,
              },
              "inputTokens": 7920,
              "outputTokenDetails": {
                "reasoningTokens": undefined,
                "textTokens": 922,
              },
              "outputTokens": 922,
              "totalTokens": 8842,
            }
          `);
        });
      });

      describe('prepareStep calls', () => {
        it('should call prepareStep for each step with correct stepNumber', async () => {
          await result.consumeStream();
          expect(prepareStepCalls.length).toBe(5);
          expect(prepareStepCalls[0].stepNumber).toBe(0);
          expect(prepareStepCalls[1].stepNumber).toBe(1);
          expect(prepareStepCalls[2].stepNumber).toBe(2);
          expect(prepareStepCalls[3].stepNumber).toBe(3);
          expect(prepareStepCalls[4].stepNumber).toBe(4);
        });

        it('should pass empty steps array for first prepareStep call', async () => {
          await result.consumeStream();
          expect(prepareStepCalls[0].steps.length).toBe(0);
        });

        it('should pass accumulated steps to subsequent prepareStep calls', async () => {
          await result.consumeStream();
          expect(prepareStepCalls[1].steps.length).toBe(1);
          expect(prepareStepCalls[2].steps.length).toBe(2);
          expect(prepareStepCalls[3].steps.length).toBe(3);
          expect(prepareStepCalls[4].steps.length).toBe(4);
        });

        it('should pass accumulated messages to prepareStep', async () => {
          await result.consumeStream();
          // Step 0: just the initial user message
          expect(prepareStepCalls[0].messages.length).toBe(1);

          // Step 1: user message + assistant message + tool message
          expect(prepareStepCalls[1].messages.length).toBe(3);

          // Step 2: user message + assistant + tool + assistant + tool
          expect(prepareStepCalls[2].messages.length).toBe(5);

          // Step 3: continued accumulation
          expect(prepareStepCalls[3].messages.length).toBe(7);

          // Step 4: continued accumulation
          expect(prepareStepCalls[4].messages.length).toBe(9);
        });
      });

      describe('onStepFinish callback', () => {
        it('should be called for each step', async () => {
          await result.consumeStream();
          expect(onStepFinishResults.length).toBe(5);
        });

        it('should contain correct finishReason for each step', async () => {
          await result.consumeStream();
          expect(onStepFinishResults[0].finishReason).toBe('tool-calls');
          expect(onStepFinishResults[1].finishReason).toBe('tool-calls');
          expect(onStepFinishResults[2].finishReason).toBe('tool-calls');
          expect(onStepFinishResults[3].finishReason).toBe('tool-calls');
          expect(onStepFinishResults[4].finishReason).toBe('stop');
        });

        it('should contain provider metadata with container ID for steps 1 and 2', async () => {
          await result.consumeStream();
          expect(onStepFinishResults[0].providerMetadata)
            .toMatchInlineSnapshot(`
              {
                "anthropic": {
                  "container": {
                    "id": "container_011CWHPPTDTn1XufeRB9uHeH",
                  },
                },
              }
            `);
          expect(onStepFinishResults[1].providerMetadata)
            .toMatchInlineSnapshot(`
              {
                "anthropic": {
                  "container": {
                    "id": "container_011CWHPPTDTn1XufeRB9uHeH",
                  },
                },
              }
            `);
        });
      });

      describe('onFinish callback', () => {
        it('should be called with correct text', async () => {
          await result.consumeStream();
          expect(onFinishResult.text).toContain('Game Results');
        });

        it('should be called with correct finishReason', async () => {
          await result.consumeStream();
          expect(onFinishResult.finishReason).toBe('stop');
        });

        it('should contain all steps', async () => {
          await result.consumeStream();
          expect(onFinishResult.steps.length).toBe(5);
        });

        it('should contain correct usage', async () => {
          await result.consumeStream();
          expect(onFinishResult.usage).toMatchInlineSnapshot(`
            {
              "inputTokenDetails": {
                "cacheReadTokens": undefined,
                "cacheWriteTokens": undefined,
                "noCacheTokens": 7920,
              },
              "inputTokens": 7920,
              "outputTokenDetails": {
                "reasoningTokens": undefined,
                "textTokens": 922,
              },
              "outputTokens": 922,
              "totalTokens": 8842,
            }
          `);
        });

        it('should contain response messages from all steps', async () => {
          await result.consumeStream();
          expect(onFinishResult.responseMessages.length).toBe(9);
        });
      });

      describe('stream events', () => {
        it('should emit correct stream parts including tool calls and deferred results', async () => {
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
                  "id": "1",
                  "type": "text-start",
                },
                {
                  "id": "1",
                  "providerMetadata": undefined,
                  "text": "I'll help you simulate this game between two players where one is using a loaded die.",
                  "type": "text-delta",
                },
                {
                  "id": "1",
                  "type": "text-end",
                },
                {
                  "input": {
                    "code": "game_loop()",
                  },
                  "providerExecuted": true,
                  "providerMetadata": undefined,
                  "title": undefined,
                  "toolCallId": "srvtoolu_01MzSrFWsmzBdcoQkGWLyRjK",
                  "toolName": "code_execution",
                  "type": "tool-call",
                },
                {
                  "input": {
                    "player": "player1",
                  },
                  "providerExecuted": undefined,
                  "providerMetadata": undefined,
                  "title": undefined,
                  "toolCallId": "toolu_019jKkXz4jAdwHweHBw92CVY",
                  "toolName": "rollDie",
                  "type": "tool-call",
                },
                {
                  "dynamic": false,
                  "input": {
                    "player": "player1",
                  },
                  "output": 6,
                  "toolCallId": "toolu_019jKkXz4jAdwHweHBw92CVY",
                  "toolName": "rollDie",
                  "type": "tool-result",
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
                    "toolExecutionMs": {
                      "toolu_019jKkXz4jAdwHweHBw92CVY": 0,
                    },
                  },
                  "providerMetadata": {
                    "anthropic": {
                      "container": {
                        "id": "container_011CWHPPTDTn1XufeRB9uHeH",
                      },
                    },
                  },
                  "rawFinishReason": undefined,
                  "response": {
                    "headers": {
                      "call": "1",
                    },
                    "id": "msg_01ERcBqAvLTHWQDk9c9qJLWC",
                    "modelId": "claude-sonnet-4-5-20250929",
                    "timestamp": 1970-01-01T00:00:00.000Z,
                  },
                  "type": "finish-step",
                  "usage": {
                    "inputTokenDetails": {
                      "cacheReadTokens": undefined,
                      "cacheWriteTokens": undefined,
                      "noCacheTokens": 3369,
                    },
                    "inputTokens": 3369,
                    "outputTokenDetails": {
                      "reasoningTokens": undefined,
                      "textTokens": 725,
                    },
                    "outputTokens": 725,
                    "raw": undefined,
                    "totalTokens": 4094,
                  },
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
                  "input": {
                    "player": "player2",
                  },
                  "providerExecuted": undefined,
                  "providerMetadata": undefined,
                  "title": undefined,
                  "toolCallId": "toolu_015dGLMbwBKv1ZRQr6KdJzeH",
                  "toolName": "rollDie",
                  "type": "tool-call",
                },
                {
                  "dynamic": false,
                  "input": {
                    "player": "player2",
                  },
                  "output": 3,
                  "toolCallId": "toolu_015dGLMbwBKv1ZRQr6KdJzeH",
                  "toolName": "rollDie",
                  "type": "tool-result",
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
                    "timeBetweenOutputChunksMs": undefined,
                    "timeToFirstOutputMs": 0,
                    "toolExecutionMs": {
                      "toolu_015dGLMbwBKv1ZRQr6KdJzeH": 0,
                    },
                  },
                  "providerMetadata": {
                    "anthropic": {
                      "container": {
                        "id": "container_011CWHPPTDTn1XufeRB9uHeH",
                      },
                    },
                  },
                  "rawFinishReason": undefined,
                  "response": {
                    "headers": {
                      "call": "2",
                    },
                    "id": "msg_01KSVw3xmXbMNJPNMt46BC5W",
                    "modelId": "claude-sonnet-4-5-20250929",
                    "timestamp": 1970-01-01T00:00:01.000Z,
                  },
                  "type": "finish-step",
                  "usage": {
                    "inputTokenDetails": {
                      "cacheReadTokens": undefined,
                      "cacheWriteTokens": undefined,
                      "noCacheTokens": 0,
                    },
                    "inputTokens": 0,
                    "outputTokenDetails": {
                      "reasoningTokens": undefined,
                      "textTokens": 0,
                    },
                    "outputTokens": 0,
                    "raw": undefined,
                    "totalTokens": 0,
                  },
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
                  "input": {
                    "player": "player1",
                  },
                  "providerExecuted": undefined,
                  "providerMetadata": undefined,
                  "title": undefined,
                  "toolCallId": "toolu_01YYqBNq5mk1wMtv3PAqY44m",
                  "toolName": "rollDie",
                  "type": "tool-call",
                },
                {
                  "dynamic": false,
                  "input": {
                    "player": "player1",
                  },
                  "output": 6,
                  "toolCallId": "toolu_01YYqBNq5mk1wMtv3PAqY44m",
                  "toolName": "rollDie",
                  "type": "tool-result",
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
                    "timeBetweenOutputChunksMs": undefined,
                    "timeToFirstOutputMs": 0,
                    "toolExecutionMs": {
                      "toolu_01YYqBNq5mk1wMtv3PAqY44m": 0,
                    },
                  },
                  "providerMetadata": {
                    "anthropic": {
                      "container": {
                        "id": "container_011CWHPPTDTn1XufeRB9uHeH",
                      },
                    },
                  },
                  "rawFinishReason": undefined,
                  "response": {
                    "headers": {
                      "call": "3",
                    },
                    "id": "msg_016fLapHzDx8DG2SUcsGKyPA",
                    "modelId": "claude-sonnet-4-5-20250929",
                    "timestamp": 1970-01-01T00:00:02.000Z,
                  },
                  "type": "finish-step",
                  "usage": {
                    "inputTokenDetails": {
                      "cacheReadTokens": undefined,
                      "cacheWriteTokens": undefined,
                      "noCacheTokens": 0,
                    },
                    "inputTokens": 0,
                    "outputTokenDetails": {
                      "reasoningTokens": undefined,
                      "textTokens": 0,
                    },
                    "outputTokens": 0,
                    "raw": undefined,
                    "totalTokens": 0,
                  },
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
                  "input": {
                    "player": "player2",
                  },
                  "providerExecuted": undefined,
                  "providerMetadata": undefined,
                  "title": undefined,
                  "toolCallId": "toolu_018WxjDkQG8h7i63poySGT2x",
                  "toolName": "rollDie",
                  "type": "tool-call",
                },
                {
                  "dynamic": false,
                  "input": {
                    "player": "player2",
                  },
                  "output": 3,
                  "toolCallId": "toolu_018WxjDkQG8h7i63poySGT2x",
                  "toolName": "rollDie",
                  "type": "tool-result",
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
                    "timeBetweenOutputChunksMs": undefined,
                    "timeToFirstOutputMs": 0,
                    "toolExecutionMs": {
                      "toolu_018WxjDkQG8h7i63poySGT2x": 0,
                    },
                  },
                  "providerMetadata": {
                    "anthropic": {
                      "container": {
                        "id": "container_011CWHPPTDTn1XufeRB9uHeH",
                      },
                    },
                  },
                  "rawFinishReason": undefined,
                  "response": {
                    "headers": {
                      "call": "4",
                    },
                    "id": "msg_01MQHz6AzmwmZoTry5nk5EQC",
                    "modelId": "claude-sonnet-4-5-20250929",
                    "timestamp": 1970-01-01T00:00:03.000Z,
                  },
                  "type": "finish-step",
                  "usage": {
                    "inputTokenDetails": {
                      "cacheReadTokens": undefined,
                      "cacheWriteTokens": undefined,
                      "noCacheTokens": 0,
                    },
                    "inputTokens": 0,
                    "outputTokenDetails": {
                      "reasoningTokens": undefined,
                      "textTokens": 0,
                    },
                    "outputTokens": 0,
                    "raw": undefined,
                    "totalTokens": 0,
                  },
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
                  "dynamic": undefined,
                  "input": undefined,
                  "output": {
                    "content": [],
                    "return_code": 0,
                    "stderr": "",
                    "stdout": "=== DICE GAME: First to 3 Wins ===

              --- Round 1 ---
              Player 1 rolls: 5
              Player 2 rolls: 6
              Player 2 wins this round!
              Score: Player 1 = 0, Player 2 = 1

              --- Round 2 ---
              Player 1 rolls: 4
              Player 2 rolls: 6
              Player 2 wins this round!
              Score: Player 1 = 0, Player 2 = 2

              --- Round 3 ---
              Player 1 rolls: 5
              Player 2 rolls: 2
              Player 1 wins this round!
              Score: Player 1 = 1, Player 2 = 2

              --- Round 4 ---
              Player 1 rolls: 6
              Player 2 rolls: 6
              Draw! No one gets a point.
              Score: Player 1 = 1, Player 2 = 2

              --- Round 5 ---
              Player 1 rolls: 3
              Player 2 rolls: 2
              Player 1 wins this round!
              Score: Player 1 = 2, Player 2 = 2

              --- Round 6 ---
              Player 1 rolls: 6
              Player 2 rolls: 6
              Draw! No one gets a point.
              Score: Player 1 = 2, Player 2 = 2

              --- Round 7 ---
              Player 1 rolls: 2
              Player 2 rolls: 3
              Player 2 wins this round!
              Score: Player 1 = 2, Player 2 = 3

              ========================================
              🏆 GAME OVER: Player 2 wins the game! (3-2)
              ========================================

              📊 Analysis:
              Total rounds played: 7
              Player 2 had better results - likely using the loaded die! 🎲
              ",
                    "type": "code_execution_result",
                  },
                  "providerExecuted": true,
                  "toolCallId": "srvtoolu_01MzSrFWsmzBdcoQkGWLyRjK",
                  "toolName": "code_execution",
                  "type": "tool-result",
                },
                {
                  "id": "2",
                  "type": "text-start",
                },
                {
                  "id": "2",
                  "providerMetadata": undefined,
                  "text": "## Game Results

              **Player 2 wins the game 3-2!** 🏆

              The game lasted 7 rounds with the following breakdown:
              - **Player 1**: 2 round wins
              - **Player 2**: 3 round wins
              - **Draws**: 2 rounds (both rolling 6)

              Based on the results, **Player 2 appears to be the one using the loaded die**.",
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
                    "timeBetweenOutputChunksMs": undefined,
                    "timeToFirstOutputMs": 0,
                    "toolExecutionMs": {},
                  },
                  "providerMetadata": undefined,
                  "rawFinishReason": "stop",
                  "response": {
                    "headers": {
                      "call": "5",
                    },
                    "id": "msg_01CfmDducyrt61n4Q7QS8VFK",
                    "modelId": "claude-sonnet-4-5-20250929",
                    "timestamp": 1970-01-01T00:00:04.000Z,
                  },
                  "type": "finish-step",
                  "usage": {
                    "inputTokenDetails": {
                      "cacheReadTokens": undefined,
                      "cacheWriteTokens": undefined,
                      "noCacheTokens": 4551,
                    },
                    "inputTokens": 4551,
                    "outputTokenDetails": {
                      "reasoningTokens": undefined,
                      "textTokens": 197,
                    },
                    "outputTokens": 197,
                    "raw": undefined,
                    "totalTokens": 4748,
                  },
                },
                {
                  "finishReason": "stop",
                  "rawFinishReason": "stop",
                  "totalUsage": {
                    "inputTokenDetails": {
                      "cacheReadTokens": undefined,
                      "cacheWriteTokens": undefined,
                      "noCacheTokens": 7920,
                    },
                    "inputTokens": 7920,
                    "outputTokenDetails": {
                      "reasoningTokens": undefined,
                      "textTokens": 922,
                    },
                    "outputTokens": 922,
                    "totalTokens": 8842,
                  },
                  "type": "finish",
                },
              ]
            `);
        });
      });
    });

    describe('deferred tool calls with tool-error', () => {
      it('should resolve deferred tool call when tool-error is in the same step', async () => {
        const result = streamText({
          model: new MockLanguageModelV4({
            doStream: async () => {
              return {
                stream: convertArrayToReadableStream([
                  {
                    type: 'response-metadata',
                    id: 'msg-1',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolName: 'deferred_tool',
                    input: `{ "value": "test" }`,
                    providerExecuted: true,
                  },
                  {
                    type: 'tool-result',
                    toolCallId: 'call-1',
                    toolName: 'deferred_tool',
                    result: `ERROR`,
                    isError: true,
                    providerExecuted: true,
                  },
                  {
                    type: 'text-start',
                    id: '1',
                  },
                  {
                    type: 'text-delta',
                    id: '1',
                    delta: 'Final response',
                  },
                  {
                    type: 'text-end',
                    id: '1',
                  },
                  {
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: testUsage,
                  },
                ]),
                response: {},
              };
            },
          }),
          tools: {
            deferred_tool: {
              type: 'provider',
              isProviderExecuted: true,
              id: 'test.deferred_tool',
              inputSchema: z.object({ value: z.string() }),
              outputSchema: z.object({ value: z.string() }),
              args: {},
              supportsDeferredResults: true,
            },
          },
          ...defaultSettings(),
          stopWhen: isStepCount(2),
        });

        // Consume the stream
        await result.consumeStream();

        // Verify that the stream completes with only one step
        // (if the deferred tool call wasn't resolved, it would wait for another step)
        expect((await result.steps).length).toBe(1);

        expect(await result.content).toMatchInlineSnapshot(`
          [
            {
              "input": {
                "value": "test",
              },
              "providerExecuted": true,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "deferred_tool",
              "type": "tool-call",
            },
            {
              "dynamic": undefined,
              "error": "ERROR",
              "input": {
                "value": "test",
              },
              "providerExecuted": true,
              "toolCallId": "call-1",
              "toolName": "deferred_tool",
              "type": "tool-error",
            },
            {
              "providerMetadata": undefined,
              "text": "Final response",
              "type": "text",
            },
          ]
        `);
      });

      it('should resolve deferred tool call when tool-error arrives in a later step', async () => {
        let responseCount = 0;
        const result = streamText({
          model: new MockLanguageModelV4({
            doStream: async () => {
              switch (responseCount++) {
                case 0:
                  // Step 1: tool call without result
                  return {
                    stream: convertArrayToReadableStream([
                      {
                        type: 'response-metadata',
                        id: 'msg-1',
                        modelId: 'mock-model-id',
                        timestamp: new Date(0),
                      },
                      {
                        type: 'tool-call',
                        toolCallId: 'call-1',
                        toolName: 'deferred_tool',
                        input: `{ "value": "test" }`,
                        providerExecuted: true,
                      },
                      {
                        type: 'finish',
                        finishReason: { unified: 'tool-calls', raw: undefined },
                        usage: testUsage,
                      },
                    ]),
                    response: {},
                  };
                case 1:
                  // Step 2: tool-error arrives
                  return {
                    stream: convertArrayToReadableStream([
                      {
                        type: 'response-metadata',
                        id: 'msg-2',
                        modelId: 'mock-model-id',
                        timestamp: new Date(1000),
                      },
                      {
                        type: 'tool-result',
                        toolCallId: 'call-1',
                        toolName: 'deferred_tool',
                        result: `ERROR`,
                        isError: true,
                        providerExecuted: true,
                      },
                      {
                        type: 'text-start',
                        id: '1',
                      },
                      {
                        type: 'text-delta',
                        id: '1',
                        delta: 'Final response',
                      },
                      {
                        type: 'text-end',
                        id: '1',
                      },
                      {
                        type: 'finish',
                        finishReason: { unified: 'stop', raw: 'stop' },
                        usage: testUsage,
                      },
                    ]),
                    response: {},
                  };
                default:
                  throw new Error(
                    `Unexpected response count: ${responseCount}`,
                  );
              }
            },
          }),
          tools: {
            deferred_tool: {
              type: 'provider',
              isProviderExecuted: true,
              id: 'test.deferred_tool',
              inputSchema: z.object({ value: z.string() }),
              outputSchema: z.object({ value: z.string() }),
              args: {},
              supportsDeferredResults: true,
            },
          },
          ...defaultSettings(),
          stopWhen: isStepCount(3),
        });

        // Consume the stream
        await result.consumeStream();

        // Verify that the stream completes with two steps
        expect((await result.steps).length).toBe(2);

        expect(await result.content).toMatchInlineSnapshot(`
          [
            {
              "input": {
                "value": "test",
              },
              "providerExecuted": true,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "deferred_tool",
              "type": "tool-call",
            },
            {
              "dynamic": undefined,
              "error": "ERROR",
              "input": undefined,
              "providerExecuted": true,
              "toolCallId": "call-1",
              "toolName": "deferred_tool",
              "type": "tool-error",
            },
            {
              "providerMetadata": undefined,
              "text": "Final response",
              "type": "text",
            },
          ]
        `);
      });
    });
  });

  describe('logWarnings', () => {
    it('should call logWarnings with warnings from a single step', async () => {
      const expectedWarnings = [
        {
          type: 'other' as const,
          message: 'Setting is not supported',
        },
        {
          type: 'unsupported' as const,
          feature: 'temperature',
          details: 'Temperature parameter not supported',
        },
      ];

      const result = streamText({
        model: createTestModel({
          warnings: expectedWarnings,
        }),
        ...defaultSettings(),
      });

      // Consume the stream to trigger the warning logging
      await result.finishReason;

      expect(logWarningsSpy).toHaveBeenCalledOnce();
      expect(logWarningsSpy).toHaveBeenCalledWith({
        warnings: expectedWarnings,
        provider: 'mock-provider',
        model: 'mock-model-id',
      });
    });

    it('should call logWarnings once for each step with warnings from that step', async () => {
      const warning1 = {
        type: 'other' as const,
        message: 'Warning from step 1',
      };
      const warning2 = {
        type: 'other' as const,
        message: 'Warning from step 2',
      };

      let callCount = 0;
      const model = new MockLanguageModelV4({
        doStream: async _options => {
          switch (callCount++) {
            case 0:
              return {
                stream: convertArrayToReadableStream([
                  {
                    type: 'stream-start',
                    warnings: [warning1],
                  },
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  {
                    type: 'tool-call',
                    toolCallType: 'function',
                    toolCallId: 'call-1',
                    toolName: 'testTool',
                    input: `{ "value": "test" }`,
                  },
                  {
                    type: 'finish',
                    finishReason: { unified: 'tool-calls', raw: undefined },
                    usage: testUsage,
                  },
                ]),
                response: {},
              };
            case 1:
              return {
                stream: convertArrayToReadableStream([
                  {
                    type: 'stream-start',
                    warnings: [warning2],
                  },
                  {
                    type: 'response-metadata',
                    id: 'id-1',
                    modelId: 'mock-model-id',
                    timestamp: new Date(10000),
                  },
                  { type: 'text-start', id: '1' },
                  { type: 'text-delta', id: '1', delta: 'Final response' },
                  { type: 'text-end', id: '1' },
                  {
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: testUsage,
                  },
                ]),
                response: {},
              };
            default:
              throw new Error('Unexpected call');
          }
        },
      });

      const result = streamText({
        model,
        tools: {
          testTool: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'result',
          },
        },
        stopWhen: isStepCount(3),
        ...defaultSettings(),
      });

      // Consume the stream to trigger the warning logging
      await result.finishReason;

      expect(logWarningsSpy).toHaveBeenCalledTimes(2);
      expect(logWarningsSpy).toHaveBeenNthCalledWith(1, {
        warnings: [warning1],
        provider: 'mock-provider',
        model: 'mock-model-id',
      });
      expect(logWarningsSpy).toHaveBeenNthCalledWith(2, {
        warnings: [warning2],
        provider: 'mock-provider',
        model: 'mock-model-id',
      });
    });

    it('should call logWarnings with empty array when no warnings are present', async () => {
      const result = streamText({
        model: createTestModel({
          warnings: [], // no warnings
        }),
        ...defaultSettings(),
      });

      // Consume the stream to trigger the warning logging
      await result.finishReason;

      expect(logWarningsSpy).toHaveBeenCalledOnce();
      expect(logWarningsSpy).toHaveBeenCalledWith({
        warnings: [],
        provider: 'mock-provider',
        model: 'mock-model-id',
      });
    });
  });

  describe('tool execution approval', () => {
    describe('when a single tool needs approval (user-defined)', () => {
      let result: StreamTextResult<any, any, any>;

      beforeEach(async () => {
        result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: `{ "value": "value" }`,
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
          prompt: 'test-input',
          _internal: {
            generateId: mockId({ prefix: 'id' }),
            generateCallId: () => 'test-telemetry-call-id',
          },
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async () => 'result1',
            }),
          },
          toolApproval: {
            tool1: 'user-approval',
          },
        });
      });

      it('should add tool approval requests to the full stream', async () => {
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
                "input": {
                  "value": "value",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
              {
                "approvalId": "id-1",
                "toolCall": {
                  "input": {
                    "value": "value",
                  },
                  "providerExecuted": undefined,
                  "providerMetadata": undefined,
                  "title": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
                "type": "tool-approval-request",
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
                  "timeBetweenOutputChunksMs": undefined,
                  "timeToFirstOutputMs": 0,
                  "toolExecutionMs": {},
                },
                "providerMetadata": undefined,
                "rawFinishReason": undefined,
                "response": {
                  "headers": undefined,
                  "id": "id-0",
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "type": "finish-step",
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
                "finishReason": "tool-calls",
                "rawFinishReason": undefined,
                "totalUsage": {
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
                  "totalTokens": 13,
                },
                "type": "finish",
              },
            ]
          `);
      });

      it('should add tool approval requests to the UI message stream', async () => {
        expect(await convertAsyncIterableToArray(result.toUIMessageStream()))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "start",
              },
              {
                "type": "start-step",
              },
              {
                "input": {
                  "value": "value",
                },
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-input-available",
              },
              {
                "approvalId": "id-1",
                "toolCallId": "call-1",
                "type": "tool-approval-request",
              },
              {
                "type": "finish-step",
              },
              {
                "finishReason": "tool-calls",
                "type": "finish",
              },
            ]
          `);
      });

      it('should add tool approval requests to the content', async () => {
        expect(await result.content).toMatchInlineSnapshot(`
          [
            {
              "input": {
                "value": "value",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
            {
              "approvalId": "id-1",
              "toolCall": {
                "input": {
                  "value": "value",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
              "type": "tool-approval-request",
            },
          ]
        `);
      });

      it('should add tool approval requests to the response messages', async () => {
        expect(await result.responseMessages).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "input": {
                    "value": "value",
                  },
                  "providerExecuted": undefined,
                  "providerOptions": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
                {
                  "approvalId": "id-1",
                  "isAutomatic": undefined,
                  "toolCallId": "call-1",
                  "type": "tool-approval-request",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });
    });

    describe('when a single tool is automatically rejected', () => {
      let result: StreamTextResult<any, any, any>;
      let prompts: LanguageModelV4Prompt[];
      let executeFunction: ToolExecuteFunction<any, any, any>;

      beforeEach(async () => {
        prompts = [];
        executeFunction = vi.fn().mockReturnValue('result1');

        let step = 0;
        result = streamText({
          model: new MockLanguageModelV4({
            doStream: async ({ prompt }) => {
              prompts.push(prompt);
              switch (step++) {
                case 0:
                  return {
                    stream: convertArrayToReadableStream([
                      { type: 'stream-start', warnings: [] },
                      {
                        type: 'tool-call',
                        toolCallType: 'function',
                        toolCallId: 'call-1',
                        toolName: 'tool1',
                        input: `{ "value": "value" }`,
                      },
                      {
                        type: 'finish',
                        finishReason: { unified: 'tool-calls', raw: undefined },
                        usage: testUsage,
                      },
                    ]),
                  };

                default:
                  return {
                    stream: convertArrayToReadableStream([
                      { type: 'stream-start', warnings: [] },
                      { type: 'text-start', id: '1' },
                      {
                        type: 'text-delta',
                        id: '1',
                        delta: 'Hello, world!',
                      },
                      { type: 'text-end', id: '1' },
                      {
                        type: 'finish',
                        finishReason: { unified: 'stop', raw: 'stop' },
                        usage: testUsage,
                      },
                    ]),
                  };
              }
            },
          }),
          prompt: 'test-input',
          stopWhen: isStepCount(3),
          _internal: {
            generateId: mockId({ prefix: 'id' }),
            generateCallId: () => 'test-telemetry-call-id',
          },
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: executeFunction,
            }),
          },
          toolApproval: {
            tool1: {
              type: 'denied',
              reason: 'blocked by policy',
            },
          },
        });

        await result.consumeStream();
      });

      it('should continue to a second step with text and not execute the tool', async () => {
        expect(executeFunction).not.toHaveBeenCalled();
        expect(await result.text).toBe('Hello, world!');
        expect((await result.steps).length).toBe(2);
      });

      it('should call the model again for the second step', async () => {
        expect(prompts).toMatchInlineSnapshot(`
          [
            [
              {
                "content": [
                  {
                    "text": "test-input",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
            ],
            [
              {
                "content": [
                  {
                    "text": "test-input",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
              {
                "content": [
                  {
                    "input": {
                      "value": "value",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                ],
                "providerOptions": undefined,
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "reason": "blocked by policy",
                      "type": "execution-denied",
                    },
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "providerOptions": undefined,
                "role": "tool",
              },
            ],
          ]
        `);
      });

      it('should produce response messages', async () => {
        expect(await result.responseMessages).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "input": {
                    "value": "value",
                  },
                  "providerExecuted": undefined,
                  "providerOptions": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
                {
                  "approvalId": "id-1",
                  "isAutomatic": true,
                  "toolCallId": "call-1",
                  "type": "tool-approval-request",
                },
              ],
              "role": "assistant",
            },
            {
              "content": [
                {
                  "approvalId": "id-1",
                  "approved": false,
                  "providerExecuted": undefined,
                  "reason": "blocked by policy",
                  "type": "tool-approval-response",
                },
                {
                  "output": {
                    "reason": "blocked by policy",
                    "type": "execution-denied",
                  },
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "role": "tool",
            },
            {
              "content": [
                {
                  "providerOptions": undefined,
                  "text": "Hello, world!",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });

      it('should include automatic approval denial in the ui message stream', async () => {
        expect(await convertAsyncIterableToArray(result.toUIMessageStream()))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "start",
              },
              {
                "type": "start-step",
              },
              {
                "input": {
                  "value": "value",
                },
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-input-available",
              },
              {
                "approvalId": "id-1",
                "isAutomatic": true,
                "toolCallId": "call-1",
                "type": "tool-approval-request",
              },
              {
                "approvalId": "id-1",
                "approved": false,
                "reason": "blocked by policy",
                "type": "tool-approval-response",
              },
              {
                "type": "finish-step",
              },
              {
                "type": "start-step",
              },
              {
                "id": "1",
                "type": "text-start",
              },
              {
                "delta": "Hello, world!",
                "id": "1",
                "type": "text-delta",
              },
              {
                "id": "1",
                "type": "text-end",
              },
              {
                "type": "finish-step",
              },
              {
                "finishReason": "stop",
                "type": "finish",
              },
            ]
          `);
      });
    });

    describe('when a single tool is automatically approved', () => {
      let result: StreamTextResult<any, any, any>;
      let prompts: LanguageModelV4Prompt[];
      let executeFunction: ToolExecuteFunction<any, any, any>;

      beforeEach(async () => {
        prompts = [];
        executeFunction = vi.fn().mockReturnValue('result1');

        let step = 0;
        result = streamText({
          model: new MockLanguageModelV4({
            doStream: async ({ prompt }) => {
              prompts.push(prompt);
              switch (step++) {
                case 0:
                  return {
                    stream: convertArrayToReadableStream([
                      { type: 'stream-start', warnings: [] },
                      {
                        type: 'tool-call',
                        toolCallType: 'function',
                        toolCallId: 'call-1',
                        toolName: 'tool1',
                        input: `{ "value": "value" }`,
                      },
                      {
                        type: 'finish',
                        finishReason: { unified: 'tool-calls', raw: undefined },
                        usage: testUsage,
                      },
                    ]),
                  };

                default:
                  return {
                    stream: convertArrayToReadableStream([
                      { type: 'stream-start', warnings: [] },
                      { type: 'text-start', id: '1' },
                      {
                        type: 'text-delta',
                        id: '1',
                        delta: 'Hello, world!',
                      },
                      { type: 'text-end', id: '1' },
                      {
                        type: 'finish',
                        finishReason: { unified: 'stop', raw: 'stop' },
                        usage: testUsage,
                      },
                    ]),
                  };
              }
            },
          }),
          prompt: 'test-input',
          stopWhen: isStepCount(3),
          _internal: {
            generateId: mockId({ prefix: 'id' }),
            generateCallId: () => 'test-telemetry-call-id',
          },
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: executeFunction,
            }),
          },
          toolApproval: {
            tool1: {
              type: 'approved',
              reason: 'trusted internal tool',
            },
          },
        });

        await result.consumeStream();
      });

      it('should continue to a second step and execute the tool', async () => {
        expect(executeFunction).toHaveBeenCalledWith(
          { value: 'value' },
          expect.objectContaining({
            abortSignal: undefined,
            toolCallId: 'call-1',
            messages: expect.any(Array),
          }),
        );
        expect(await result.text).toBe('Hello, world!');
        expect((await result.steps).length).toBe(2);
      });

      it('should call the model again for the second step with the tool result', async () => {
        expect(prompts).toMatchInlineSnapshot(`
          [
            [
              {
                "content": [
                  {
                    "text": "test-input",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
            ],
            [
              {
                "content": [
                  {
                    "text": "test-input",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
              {
                "content": [
                  {
                    "input": {
                      "value": "value",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                ],
                "providerOptions": undefined,
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "text",
                      "value": "result1",
                    },
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "providerOptions": undefined,
                "role": "tool",
              },
            ],
          ]
        `);
      });

      it('should produce response messages with automatic approval metadata', async () => {
        expect(await result.responseMessages).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "input": {
                    "value": "value",
                  },
                  "providerExecuted": undefined,
                  "providerOptions": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
                {
                  "approvalId": "id-1",
                  "isAutomatic": true,
                  "toolCallId": "call-1",
                  "type": "tool-approval-request",
                },
              ],
              "role": "assistant",
            },
            {
              "content": [
                {
                  "approvalId": "id-1",
                  "approved": true,
                  "providerExecuted": undefined,
                  "reason": "trusted internal tool",
                  "type": "tool-approval-response",
                },
                {
                  "output": {
                    "type": "text",
                    "value": "result1",
                  },
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "role": "tool",
            },
            {
              "content": [
                {
                  "providerOptions": undefined,
                  "text": "Hello, world!",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });

      it('should include automatic approval in the ui message stream', async () => {
        expect(await convertAsyncIterableToArray(result.toUIMessageStream()))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "start",
              },
              {
                "type": "start-step",
              },
              {
                "input": {
                  "value": "value",
                },
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-input-available",
              },
              {
                "approvalId": "id-1",
                "isAutomatic": true,
                "toolCallId": "call-1",
                "type": "tool-approval-request",
              },
              {
                "approvalId": "id-1",
                "approved": true,
                "reason": "trusted internal tool",
                "type": "tool-approval-response",
              },
              {
                "output": "result1",
                "toolCallId": "call-1",
                "type": "tool-output-available",
              },
              {
                "type": "finish-step",
              },
              {
                "type": "start-step",
              },
              {
                "id": "1",
                "type": "text-start",
              },
              {
                "delta": "Hello, world!",
                "id": "1",
                "type": "text-delta",
              },
              {
                "id": "1",
                "type": "text-end",
              },
              {
                "type": "finish-step",
              },
              {
                "finishReason": "stop",
                "type": "finish",
              },
            ]
          `);
      });
    });

    describe('when a single tool has a user-defined approval function', () => {
      let result: StreamTextResult<any, any, any>;
      let needsApprovalCalls: Array<{ input: any; options: any }> = [];

      beforeEach(async () => {
        needsApprovalCalls = [];
        result = streamText({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: `{ "value": "value-needs-approval" }`,
              },
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-2',
                toolName: 'tool1',
                input: `{ "value": "value-no-approval" }`,
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: input => `result for ${input.value}`,
            }),
          },
          toolApproval: {
            tool1: (input, options) => {
              needsApprovalCalls.push({ input, options });
              return input.value === 'value-needs-approval'
                ? 'user-approval'
                : 'not-applicable';
            },
          },
          stopWhen: isStepCount(3),
          prompt: 'test-input',
          _internal: {
            generateId: mockId({ prefix: 'id' }),
            generateCallId: () => 'test-telemetry-call-id',
          },
        });
      });

      it('should add tool approval requests to the full stream', async () => {
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
                "input": {
                  "value": "value-needs-approval",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
              {
                "approvalId": "id-1",
                "toolCall": {
                  "input": {
                    "value": "value-needs-approval",
                  },
                  "providerExecuted": undefined,
                  "providerMetadata": undefined,
                  "title": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
                "type": "tool-approval-request",
              },
              {
                "input": {
                  "value": "value-no-approval",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-2",
                "toolName": "tool1",
                "type": "tool-call",
              },
              {
                "dynamic": false,
                "input": {
                  "value": "value-no-approval",
                },
                "output": "result for value-no-approval",
                "toolCallId": "call-2",
                "toolName": "tool1",
                "type": "tool-result",
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
                  "toolExecutionMs": {
                    "call-2": 0,
                  },
                },
                "providerMetadata": undefined,
                "rawFinishReason": undefined,
                "response": {
                  "headers": undefined,
                  "id": "id-0",
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "type": "finish-step",
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
                "finishReason": "tool-calls",
                "rawFinishReason": undefined,
                "totalUsage": {
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
                  "totalTokens": 13,
                },
                "type": "finish",
              },
            ]
          `);
      });

      it('should add tool approval requests to the UI message stream', async () => {
        expect(await convertAsyncIterableToArray(result.toUIMessageStream()))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "start",
              },
              {
                "type": "start-step",
              },
              {
                "input": {
                  "value": "value-needs-approval",
                },
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-input-available",
              },
              {
                "approvalId": "id-1",
                "toolCallId": "call-1",
                "type": "tool-approval-request",
              },
              {
                "input": {
                  "value": "value-no-approval",
                },
                "toolCallId": "call-2",
                "toolName": "tool1",
                "type": "tool-input-available",
              },
              {
                "output": "result for value-no-approval",
                "toolCallId": "call-2",
                "type": "tool-output-available",
              },
              {
                "type": "finish-step",
              },
              {
                "finishReason": "tool-calls",
                "type": "finish",
              },
            ]
          `);
      });

      it('should only execute 1 step when the tool needs approval', async () => {
        expect((await result.steps).length).toBe(1);
      });

      it('should have tool-calls finish reason', async () => {
        expect(await result.finishReason).toBe('tool-calls');
      });

      it('should add a tool approval request to the content', async () => {
        expect(await result.content).toMatchInlineSnapshot(`
          [
            {
              "input": {
                "value": "value-needs-approval",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
            {
              "approvalId": "id-1",
              "toolCall": {
                "input": {
                  "value": "value-needs-approval",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
              "type": "tool-approval-request",
            },
            {
              "input": {
                "value": "value-no-approval",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-2",
              "toolName": "tool1",
              "type": "tool-call",
            },
            {
              "dynamic": false,
              "input": {
                "value": "value-no-approval",
              },
              "output": "result for value-no-approval",
              "toolCallId": "call-2",
              "toolName": "tool1",
              "type": "tool-result",
            },
          ]
        `);
      });

      it('should add tool approval requests to the response messages', async () => {
        expect(await result.responseMessages).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "input": {
                    "value": "value-needs-approval",
                  },
                  "providerExecuted": undefined,
                  "providerOptions": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
                {
                  "approvalId": "id-1",
                  "isAutomatic": undefined,
                  "toolCallId": "call-1",
                  "type": "tool-approval-request",
                },
                {
                  "input": {
                    "value": "value-no-approval",
                  },
                  "providerExecuted": undefined,
                  "providerOptions": undefined,
                  "toolCallId": "call-2",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
              ],
              "role": "assistant",
            },
            {
              "content": [
                {
                  "output": {
                    "type": "text",
                    "value": "result for value-no-approval",
                  },
                  "toolCallId": "call-2",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "role": "tool",
            },
          ]
        `);
      });

      it('should call the approval function with the correct input and options', async () => {
        await result.consumeStream();

        expect(needsApprovalCalls).toMatchInlineSnapshot(`
          [
            {
              "input": {
                "value": "value-needs-approval",
              },
              "options": {
                "messages": [
                  {
                    "content": "test-input",
                    "role": "user",
                  },
                ],
                "runtimeContext": {},
                "toolCallId": "call-1",
                "toolContext": undefined,
              },
            },
            {
              "input": {
                "value": "value-no-approval",
              },
              "options": {
                "messages": [
                  {
                    "content": "test-input",
                    "role": "user",
                  },
                ],
                "runtimeContext": {},
                "toolCallId": "call-2",
                "toolContext": undefined,
              },
            },
          ]
        `);
      });
    });

    describe('when a call from a single tool that needs approval is approved', () => {
      let result: StreamTextResult<any, any, any>;
      let prompts: LanguageModelV4Prompt[];
      let executeFunction: ToolExecuteFunction<any, any, any>;
      let sandbox: SandboxSession;

      beforeEach(async () => {
        prompts = [];
        executeFunction = vi.fn().mockReturnValue('result1');
        sandbox = {
          description: 'test sandbox',
          run: vi.fn(async () => ({
            exitCode: 0,
            stdout: 'ok',
            stderr: '',
          })),
          ...mockSandboxSessionFileStubs,
        };
        result = streamText({
          model: new MockLanguageModelV4({
            doStream: async ({ prompt }) => {
              prompts.push(prompt);
              return {
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'text-start', id: '1' },
                  {
                    type: 'text-delta',
                    id: '1',
                    delta: 'Hello, world!',
                  },
                  { type: 'text-end', id: '1' },
                  {
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: testUsage,
                  },
                ]),
              };
            },
          }),
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: executeFunction,
            }),
          },
          toolApproval: {
            tool1: 'user-approval',
          },
          experimental_sandbox: sandbox,
          stopWhen: isStepCount(3),
          _internal: {
            generateId: mockId({ prefix: 'id' }),
            generateCallId: () => 'test-telemetry-call-id',
          },
          messages: [
            { role: 'user', content: 'test-input' },
            {
              role: 'assistant',
              content: [
                {
                  input: {
                    value: 'value',
                  },
                  providerExecuted: undefined,
                  providerOptions: undefined,
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  type: 'tool-call',
                },
                {
                  approvalId: 'id-1',
                  toolCallId: 'call-1',
                  type: 'tool-approval-request',
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  approvalId: 'id-1',
                  type: 'tool-approval-response',
                  approved: true,
                },
              ],
            },
          ],
        });

        await result.consumeStream();
      });

      it('should execute the tool', async () => {
        expect(executeFunction).toHaveBeenCalledWith(
          { value: 'value' },
          expect.objectContaining({
            abortSignal: undefined,
            toolCallId: 'call-1',
            messages: expect.any(Array),
          }),
        );
      });

      it('should pass sandbox to approved tool execution', async () => {
        expect(executeFunction).toHaveBeenCalledWith(
          { value: 'value' },
          expect.objectContaining({
            experimental_sandbox: sandbox,
          }),
        );
      });

      it('should call the model with a prompt that includes the tool result', async () => {
        expect(prompts).toMatchInlineSnapshot(`
          [
            [
              {
                "content": [
                  {
                    "text": "test-input",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
              {
                "content": [
                  {
                    "input": {
                      "value": "value",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                ],
                "providerOptions": undefined,
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "text",
                      "value": "result1",
                    },
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "providerOptions": undefined,
                "role": "tool",
              },
            ],
          ]
        `);
      });

      it('should include the tool result in the response messages', async () => {
        expect(await result.responseMessages).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "output": {
                    "type": "text",
                    "value": "result1",
                  },
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "role": "tool",
            },
            {
              "content": [
                {
                  "providerOptions": undefined,
                  "text": "Hello, world!",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });

      it('should pass the initial tool result in responseMessages to prepareStep', async () => {
        const prepareStepResponseMessages: Array<ModelMessage[]> = [];

        const result = streamText({
          model: new MockLanguageModelV4({
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: '1' },
                {
                  type: 'text-delta',
                  id: '1',
                  delta: 'Hello, world!',
                },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            }),
          }),
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: () => 'result1',
            }),
          },
          toolApproval: {
            tool1: 'user-approval',
          },
          stopWhen: isStepCount(3),
          messages: [
            { role: 'user', content: 'test-input' },
            {
              role: 'assistant',
              content: [
                {
                  input: { value: 'value' },
                  providerExecuted: undefined,
                  providerOptions: undefined,
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  type: 'tool-call',
                },
                {
                  approvalId: 'id-1',
                  toolCallId: 'call-1',
                  type: 'tool-approval-request',
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  approvalId: 'id-1',
                  type: 'tool-approval-response',
                  approved: true,
                },
              ],
            },
          ],
          prepareStep: ({ responseMessages }) => {
            prepareStepResponseMessages.push([...responseMessages]);
            return undefined;
          },
        });

        await result.consumeStream();

        expect(prepareStepResponseMessages).toMatchInlineSnapshot(`
          [
            [
              {
                "content": [
                  {
                    "output": {
                      "type": "text",
                      "value": "result1",
                    },
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "role": "tool",
              },
            ],
          ]
        `);
      });

      it('should include the tool result in the full stream', async () => {
        expect(await convertAsyncIterableToArray(result.stream))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "start",
              },
              {
                "dynamic": false,
                "input": {
                  "value": "value",
                },
                "output": "result1",
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-result",
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
                "id": "1",
                "type": "text-start",
              },
              {
                "id": "1",
                "providerMetadata": undefined,
                "text": "Hello, world!",
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
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "type": "finish-step",
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
                "finishReason": "stop",
                "rawFinishReason": "stop",
                "totalUsage": {
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
                  "totalTokens": 13,
                },
                "type": "finish",
              },
            ]
          `);
      });

      it('should include the tool result in the ui message stream', async () => {
        expect(await convertAsyncIterableToArray(result.toUIMessageStream()))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "start",
              },
              {
                "output": "result1",
                "toolCallId": "call-1",
                "type": "tool-output-available",
              },
              {
                "type": "start-step",
              },
              {
                "id": "1",
                "type": "text-start",
              },
              {
                "delta": "Hello, world!",
                "id": "1",
                "type": "text-delta",
              },
              {
                "id": "1",
                "type": "text-end",
              },
              {
                "type": "finish-step",
              },
              {
                "finishReason": "stop",
                "type": "finish",
              },
            ]
          `);
      });
    });

    describe('when a call from a single tool that needs approval is approved and the tool throws', () => {
      let result: StreamTextResult<any, any, any>;
      let prompts: LanguageModelV4Prompt[];

      beforeEach(async () => {
        prompts = [];
        result = streamText({
          model: new MockLanguageModelV4({
            doStream: async ({ prompt }) => {
              prompts.push(prompt);
              return {
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'text-start', id: '1' },
                  {
                    type: 'text-delta',
                    id: '1',
                    delta: 'Hello, world!',
                  },
                  { type: 'text-end', id: '1' },
                  {
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: testUsage,
                  },
                ]),
              };
            },
          }),
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async (): Promise<string> => {
                throw new Error('No valid token for plugin');
              },
            }),
          },
          toolApproval: {
            tool1: 'user-approval',
          },
          stopWhen: isStepCount(3),
          _internal: {
            generateId: mockId({ prefix: 'id' }),
          },
          messages: [
            { role: 'user', content: 'test-input' },
            {
              role: 'assistant',
              content: [
                {
                  input: {
                    value: 'value',
                  },
                  providerExecuted: undefined,
                  providerOptions: undefined,
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  type: 'tool-call',
                },
                {
                  approvalId: 'id-1',
                  toolCallId: 'call-1',
                  type: 'tool-approval-request',
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  approvalId: 'id-1',
                  type: 'tool-approval-response',
                  approved: true,
                },
              ],
            },
          ],
        });

        await result.consumeStream();
      });

      it('should serialize the tool error as error-text in the continuation prompt', async () => {
        expect(prompts).toEqual([
          [
            {
              role: 'user',
              content: [{ type: 'text', text: 'test-input' }],
              providerOptions: undefined,
            },
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  input: { value: 'value' },
                  providerExecuted: undefined,
                  providerOptions: undefined,
                },
              ],
              providerOptions: undefined,
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  output: {
                    type: 'error-text',
                    value: 'Error: No valid token for plugin',
                  },
                  providerOptions: undefined,
                },
              ],
              providerOptions: undefined,
            },
          ],
        ]);
      });
    });

    describe('when a call from a single tool with preliminary results that needs approval is approved', () => {
      let result: StreamTextResult<any, any, any>;
      let prompts: LanguageModelV4Prompt[];

      beforeEach(async () => {
        prompts = [];
        result = streamText({
          model: new MockLanguageModelV4({
            doStream: async ({ prompt }) => {
              prompts.push(prompt);
              return {
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'text-start', id: '1' },
                  {
                    type: 'text-delta',
                    id: '1',
                    delta: 'Hello, world!',
                  },
                  { type: 'text-end', id: '1' },
                  {
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: testUsage,
                  },
                ]),
              };
            },
          }),
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              async *execute() {
                yield 'preliminary-result';
                yield 'final-result';
              },
            }),
          },
          toolApproval: {
            tool1: 'user-approval',
          },
          stopWhen: isStepCount(3),
          _internal: {
            generateId: mockId({ prefix: 'id' }),
            generateCallId: () => 'test-telemetry-call-id',
          },
          messages: [
            { role: 'user', content: 'test-input' },
            {
              role: 'assistant',
              content: [
                {
                  input: {
                    value: 'value',
                  },
                  providerExecuted: undefined,
                  providerOptions: undefined,
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  type: 'tool-call',
                },
                {
                  approvalId: 'id-1',
                  toolCallId: 'call-1',
                  type: 'tool-approval-request',
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  approvalId: 'id-1',
                  type: 'tool-approval-response',
                  approved: true,
                },
              ],
            },
          ],
        });

        await result.consumeStream();
      });

      it('should call the model with a prompt that includes the tool result', async () => {
        expect(prompts).toMatchInlineSnapshot(`
          [
            [
              {
                "content": [
                  {
                    "text": "test-input",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
              {
                "content": [
                  {
                    "input": {
                      "value": "value",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                ],
                "providerOptions": undefined,
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "text",
                      "value": "final-result",
                    },
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "providerOptions": undefined,
                "role": "tool",
              },
            ],
          ]
        `);
      });

      it('should include the tool result in the response messages', async () => {
        expect(await result.responseMessages).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "output": {
                    "type": "text",
                    "value": "final-result",
                  },
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "role": "tool",
            },
            {
              "content": [
                {
                  "providerOptions": undefined,
                  "text": "Hello, world!",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });

      it('should include the tool result in the full stream', async () => {
        expect(await convertAsyncIterableToArray(result.stream))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "start",
              },
              {
                "input": {
                  "value": "value",
                },
                "output": "preliminary-result",
                "preliminary": true,
                "providerExecuted": undefined,
                "providerOptions": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-result",
              },
              {
                "input": {
                  "value": "value",
                },
                "output": "final-result",
                "preliminary": true,
                "providerExecuted": undefined,
                "providerOptions": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-result",
              },
              {
                "dynamic": false,
                "input": {
                  "value": "value",
                },
                "output": "final-result",
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-result",
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
                "id": "1",
                "type": "text-start",
              },
              {
                "id": "1",
                "providerMetadata": undefined,
                "text": "Hello, world!",
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
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "type": "finish-step",
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
                "finishReason": "stop",
                "rawFinishReason": "stop",
                "totalUsage": {
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
                  "totalTokens": 13,
                },
                "type": "finish",
              },
            ]
          `);
      });

      it('should include the tool result in the ui message stream', async () => {
        expect(await convertAsyncIterableToArray(result.toUIMessageStream()))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "start",
              },
              {
                "output": "preliminary-result",
                "preliminary": true,
                "toolCallId": "call-1",
                "type": "tool-output-available",
              },
              {
                "output": "final-result",
                "preliminary": true,
                "toolCallId": "call-1",
                "type": "tool-output-available",
              },
              {
                "output": "final-result",
                "toolCallId": "call-1",
                "type": "tool-output-available",
              },
              {
                "type": "start-step",
              },
              {
                "id": "1",
                "type": "text-start",
              },
              {
                "delta": "Hello, world!",
                "id": "1",
                "type": "text-delta",
              },
              {
                "id": "1",
                "type": "text-end",
              },
              {
                "type": "finish-step",
              },
              {
                "finishReason": "stop",
                "type": "finish",
              },
            ]
          `);
      });
    });

    describe('when a call from a single tool that needs approval is denied', () => {
      let result: StreamTextResult<any, any, any>;
      let prompts: LanguageModelV4Prompt[];
      let executeFunction: ToolExecuteFunction<any, any, any>;

      beforeEach(async () => {
        prompts = [];
        executeFunction = vi.fn().mockReturnValue('result1');
        result = streamText({
          model: new MockLanguageModelV4({
            doStream: async ({ prompt }) => {
              prompts.push(prompt);
              return {
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'text-start', id: '1' },
                  {
                    type: 'text-delta',
                    id: '1',
                    delta: 'Hello, world!',
                  },
                  { type: 'text-end', id: '1' },
                  {
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: testUsage,
                  },
                ]),
              };
            },
          }),
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: executeFunction,
            }),
          },
          toolApproval: {
            tool1: 'user-approval',
          },
          stopWhen: isStepCount(3),
          _internal: {
            generateId: mockId({ prefix: 'id' }),
            generateCallId: () => 'test-telemetry-call-id',
          },
          messages: [
            { role: 'user', content: 'test-input' },
            {
              role: 'assistant',
              content: [
                {
                  input: {
                    value: 'value',
                  },
                  providerExecuted: undefined,
                  providerOptions: undefined,
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  type: 'tool-call',
                },
                {
                  approvalId: 'id-1',
                  toolCallId: 'call-1',
                  type: 'tool-approval-request',
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  approvalId: 'id-1',
                  type: 'tool-approval-response',
                  approved: false,
                },
              ],
            },
          ],
        });

        await result.consumeStream();
      });

      it('should not execute the tool', async () => {
        expect(executeFunction).not.toHaveBeenCalled();
      });

      it('should call the model with a prompt that includes the tool result', async () => {
        expect(prompts).toMatchInlineSnapshot(`
          [
            [
              {
                "content": [
                  {
                    "text": "test-input",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
              {
                "content": [
                  {
                    "input": {
                      "value": "value",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                ],
                "providerOptions": undefined,
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "reason": undefined,
                      "type": "execution-denied",
                    },
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "providerOptions": undefined,
                "role": "tool",
              },
            ],
          ]
        `);
      });

      it('should include the tool error in the response messages', async () => {
        expect(await result.responseMessages).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "output": {
                    "reason": undefined,
                    "type": "execution-denied",
                  },
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "role": "tool",
            },
            {
              "content": [
                {
                  "providerOptions": undefined,
                  "text": "Hello, world!",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });

      it('should include the tool denied in the full stream', async () => {
        expect(await convertAsyncIterableToArray(result.stream))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "start",
              },
              {
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-output-denied",
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
                "id": "1",
                "type": "text-start",
              },
              {
                "id": "1",
                "providerMetadata": undefined,
                "text": "Hello, world!",
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
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "type": "finish-step",
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
                "finishReason": "stop",
                "rawFinishReason": "stop",
                "totalUsage": {
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
                  "totalTokens": 13,
                },
                "type": "finish",
              },
            ]
          `);
      });

      it('should include the tool denied in the ui message stream', async () => {
        expect(await convertAsyncIterableToArray(result.toUIMessageStream()))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "start",
              },
              {
                "toolCallId": "call-1",
                "type": "tool-output-denied",
              },
              {
                "type": "start-step",
              },
              {
                "id": "1",
                "type": "text-start",
              },
              {
                "delta": "Hello, world!",
                "id": "1",
                "type": "text-delta",
              },
              {
                "id": "1",
                "type": "text-end",
              },
              {
                "type": "finish-step",
              },
              {
                "finishReason": "stop",
                "type": "finish",
              },
            ]
          `);
      });
    });

    describe('provider-executed tool (MCP) approval', () => {
      describe('when a provider-executed tool emits tool-approval-request', () => {
        let result: StreamTextResult<any, any, any>;

        beforeEach(async () => {
          result = streamText({
            model: createTestModel({
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                {
                  type: 'tool-call',
                  toolCallId: 'mcp-call-1',
                  toolName: 'mcp_tool',
                  input: `{ "query": "test" }`,
                  providerExecuted: true,
                },
                {
                  type: 'tool-approval-request',
                  approvalId: 'mcp-approval-1',
                  toolCallId: 'mcp-call-1',
                },
                {
                  type: 'finish',
                  finishReason: { unified: 'tool-calls', raw: undefined },
                  usage: testUsage,
                },
              ]),
            }),
            tools: {
              mcp_tool: {
                type: 'provider',
                isProviderExecuted: true,
                id: 'test.mcp_tool',
                inputSchema: z.object({ query: z.string() }),
                args: {},
              },
            },
            prompt: 'test-input',
            _internal: {
              generateId: mockId({ prefix: 'id' }),
              generateCallId: () => 'test-telemetry-call-id',
            },
          });
        });

        it('should add provider-executed tool approval request to full stream', async () => {
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
                  "input": {
                    "query": "test",
                  },
                  "providerExecuted": true,
                  "providerMetadata": undefined,
                  "title": undefined,
                  "toolCallId": "mcp-call-1",
                  "toolName": "mcp_tool",
                  "type": "tool-call",
                },
                {
                  "approvalId": "mcp-approval-1",
                  "toolCall": {
                    "input": {
                      "query": "test",
                    },
                    "providerExecuted": true,
                    "providerMetadata": undefined,
                    "title": undefined,
                    "toolCallId": "mcp-call-1",
                    "toolName": "mcp_tool",
                    "type": "tool-call",
                  },
                  "type": "tool-approval-request",
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
                    "timeBetweenOutputChunksMs": undefined,
                    "timeToFirstOutputMs": 0,
                    "toolExecutionMs": {},
                  },
                  "providerMetadata": undefined,
                  "rawFinishReason": undefined,
                  "response": {
                    "headers": undefined,
                    "id": "id-0",
                    "modelId": "mock-model-id",
                    "timestamp": 1970-01-01T00:00:00.000Z,
                  },
                  "type": "finish-step",
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
                  "finishReason": "tool-calls",
                  "rawFinishReason": undefined,
                  "totalUsage": {
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
                    "totalTokens": 13,
                  },
                  "type": "finish",
                },
              ]
            `);
        });

        it('should add provider-executed tool approval request to UI message stream', async () => {
          expect(await convertAsyncIterableToArray(result.toUIMessageStream()))
            .toMatchInlineSnapshot(`
              [
                {
                  "type": "start",
                },
                {
                  "type": "start-step",
                },
                {
                  "input": {
                    "query": "test",
                  },
                  "providerExecuted": true,
                  "toolCallId": "mcp-call-1",
                  "toolName": "mcp_tool",
                  "type": "tool-input-available",
                },
                {
                  "approvalId": "mcp-approval-1",
                  "toolCallId": "mcp-call-1",
                  "type": "tool-approval-request",
                },
                {
                  "type": "finish-step",
                },
                {
                  "finishReason": "tool-calls",
                  "type": "finish",
                },
              ]
            `);
        });

        it('should add provider-executed tool approval request to content', async () => {
          expect(await result.content).toMatchInlineSnapshot(`
            [
              {
                "input": {
                  "query": "test",
                },
                "providerExecuted": true,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "mcp-call-1",
                "toolName": "mcp_tool",
                "type": "tool-call",
              },
              {
                "approvalId": "mcp-approval-1",
                "toolCall": {
                  "input": {
                    "query": "test",
                  },
                  "providerExecuted": true,
                  "providerMetadata": undefined,
                  "title": undefined,
                  "toolCallId": "mcp-call-1",
                  "toolName": "mcp_tool",
                  "type": "tool-call",
                },
                "type": "tool-approval-request",
              },
            ]
          `);
        });

        it('should add provider-executed tool approval request to response messages', async () => {
          expect(await result.responseMessages).toMatchInlineSnapshot(`
            [
              {
                "content": [
                  {
                    "input": {
                      "query": "test",
                    },
                    "providerExecuted": true,
                    "providerOptions": undefined,
                    "toolCallId": "mcp-call-1",
                    "toolName": "mcp_tool",
                    "type": "tool-call",
                  },
                  {
                    "approvalId": "mcp-approval-1",
                    "isAutomatic": undefined,
                    "toolCallId": "mcp-call-1",
                    "type": "tool-approval-request",
                  },
                ],
                "role": "assistant",
              },
            ]
          `);
        });

        it('should have tool-calls finish reason', async () => {
          expect(await result.finishReason).toBe('tool-calls');
        });
      });

      describe('when a provider-executed tool approval is approved', () => {
        let result: StreamTextResult<any, any, any>;
        let prompts: LanguageModelV4Prompt[];

        beforeEach(async () => {
          prompts = [];
          result = streamText({
            model: new MockLanguageModelV4({
              doStream: async ({ prompt }) => {
                prompts.push(prompt);
                return {
                  stream: convertArrayToReadableStream([
                    { type: 'stream-start', warnings: [] },
                    {
                      type: 'tool-call',
                      toolCallId: 'mcp-call-1',
                      toolName: 'mcp_tool',
                      input: `{ "query": "test" }`,
                      providerExecuted: true,
                    },
                    {
                      type: 'tool-result',
                      toolCallId: 'mcp-call-1',
                      toolName: 'mcp_tool',
                      result: { shortened_url: 'https://short.url/abc' },
                      providerExecuted: true,
                    },
                    {
                      type: 'text-start',
                      id: '1',
                    },
                    {
                      type: 'text-delta',
                      id: '1',
                      delta:
                        'Here is your shortened URL: https://short.url/abc',
                    },
                    {
                      type: 'text-end',
                      id: '1',
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'stop', raw: 'stop' },
                      usage: testUsage,
                    },
                  ]),
                };
              },
            }),
            tools: {
              mcp_tool: {
                type: 'provider',
                isProviderExecuted: true,
                id: 'test.mcp_tool',
                inputSchema: z.object({ query: z.string() }),
                args: {},
              },
            },
            _internal: {
              generateId: mockId({ prefix: 'id' }),
              generateCallId: () => 'test-telemetry-call-id',
            },
            messages: [
              {
                role: 'user',
                content: 'Shorten this URL: https://example.com',
              },
              {
                role: 'assistant',
                content: [
                  {
                    input: { query: 'test' },
                    providerExecuted: true,
                    providerOptions: undefined,
                    toolCallId: 'mcp-call-1',
                    toolName: 'mcp_tool',
                    type: 'tool-call',
                  },
                  {
                    approvalId: 'mcp-approval-1',
                    toolCallId: 'mcp-call-1',
                    type: 'tool-approval-request',
                  },
                ],
              },
              {
                role: 'tool',
                content: [
                  {
                    approvalId: 'mcp-approval-1',
                    type: 'tool-approval-response',
                    approved: true,
                    providerExecuted: true,
                  },
                ],
              },
            ],
          });
        });

        it('should send tool-approval-response to the model exactly once', async () => {
          await result.consumeStream();
          expect(prompts[0]).toMatchInlineSnapshot(`
            [
              {
                "content": [
                  {
                    "text": "Shorten this URL: https://example.com",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
              {
                "content": [
                  {
                    "input": {
                      "query": "test",
                    },
                    "providerExecuted": true,
                    "providerOptions": undefined,
                    "toolCallId": "mcp-call-1",
                    "toolName": "mcp_tool",
                    "type": "tool-call",
                  },
                ],
                "providerOptions": undefined,
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "approvalId": "mcp-approval-1",
                    "approved": true,
                    "reason": undefined,
                    "type": "tool-approval-response",
                  },
                ],
                "providerOptions": undefined,
                "role": "tool",
              },
            ]
          `);
        });

        it('should include provider-executed tool result in content', async () => {
          expect(await result.content).toMatchInlineSnapshot(`
            [
              {
                "input": {
                  "query": "test",
                },
                "providerExecuted": true,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "mcp-call-1",
                "toolName": "mcp_tool",
                "type": "tool-call",
              },
              {
                "dynamic": undefined,
                "input": {
                  "query": "test",
                },
                "output": {
                  "shortened_url": "https://short.url/abc",
                },
                "providerExecuted": true,
                "toolCallId": "mcp-call-1",
                "toolName": "mcp_tool",
                "type": "tool-result",
              },
              {
                "providerMetadata": undefined,
                "text": "Here is your shortened URL: https://short.url/abc",
                "type": "text",
              },
            ]
          `);
        });
      });

      describe('when a provider-executed tool approval is denied', () => {
        let result: StreamTextResult<any, any, any>;
        let prompts: LanguageModelV4Prompt[];

        beforeEach(async () => {
          prompts = [];
          result = streamText({
            model: new MockLanguageModelV4({
              doStream: async ({ prompt }) => {
                prompts.push(prompt);
                return {
                  stream: convertArrayToReadableStream([
                    { type: 'stream-start', warnings: [] },
                    {
                      type: 'text-start',
                      id: '1',
                    },
                    {
                      type: 'text-delta',
                      id: '1',
                      delta:
                        'I understand. The tool execution was not approved.',
                    },
                    {
                      type: 'text-end',
                      id: '1',
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'stop', raw: 'stop' },
                      usage: testUsage,
                    },
                  ]),
                };
              },
            }),
            tools: {
              mcp_tool: {
                type: 'provider',
                isProviderExecuted: true,
                id: 'test.mcp_tool',
                inputSchema: z.object({ query: z.string() }),
                args: {},
              },
            },
            _internal: {
              generateId: mockId({ prefix: 'id' }),
              generateCallId: () => 'test-telemetry-call-id',
            },
            messages: [
              {
                role: 'user',
                content: 'Shorten this URL: https://example.com',
              },
              {
                role: 'assistant',
                content: [
                  {
                    input: { query: 'test' },
                    providerExecuted: true,
                    providerOptions: undefined,
                    toolCallId: 'mcp-call-1',
                    toolName: 'mcp_tool',
                    type: 'tool-call',
                  },
                  {
                    approvalId: 'mcp-approval-1',
                    toolCallId: 'mcp-call-1',
                    type: 'tool-approval-request',
                  },
                ],
              },
              {
                role: 'tool',
                content: [
                  {
                    approvalId: 'mcp-approval-1',
                    type: 'tool-approval-response',
                    approved: false,
                    reason: 'User denied the request',
                    providerExecuted: true,
                  },
                ],
              },
            ],
          });
        });

        it('should send denied tool-approval-response to the model exactly once', async () => {
          await result.consumeStream();
          expect(prompts[0]).toMatchInlineSnapshot(`
            [
              {
                "content": [
                  {
                    "text": "Shorten this URL: https://example.com",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
              {
                "content": [
                  {
                    "input": {
                      "query": "test",
                    },
                    "providerExecuted": true,
                    "providerOptions": undefined,
                    "toolCallId": "mcp-call-1",
                    "toolName": "mcp_tool",
                    "type": "tool-call",
                  },
                ],
                "providerOptions": undefined,
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "approvalId": "mcp-approval-1",
                    "approved": false,
                    "reason": "User denied the request",
                    "type": "tool-approval-response",
                  },
                ],
                "providerOptions": undefined,
                "role": "tool",
              },
            ]
          `);
        });

        it('should include text response from model in content', async () => {
          expect(await result.content).toMatchInlineSnapshot(`
            [
              {
                "providerMetadata": undefined,
                "text": "I understand. The tool execution was not approved.",
                "type": "text",
              },
            ]
          `);
        });

        it('should have stop finish reason', async () => {
          expect(await result.finishReason).toBe('stop');
        });
      });
    });
  });

  describe('prepareStep with model switch and image URLs', () => {
    it('should use the prepareStep model supportedUrls for download decision', async () => {
      const downloadCalls: Array<{ url: URL; isUrlSupportedByModel: boolean }> =
        [];
      const languageModelCalls: Array<LanguageModelV4CallOptions> = [];

      const modelWithImageUrlSupport = new MockLanguageModelV4({
        provider: 'with-image-url-support',
        modelId: 'with-image-url-support',
        supportedUrls: {
          'image/*': [/^https?:\/\/.*$/],
        },
        doStream: async options => {
          languageModelCalls.push(options);
          return {
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              {
                type: 'text-delta',
                id: '1',
                delta: 'response from with-image-url-support',
              },
              { type: 'text-end', id: '1' },
            ]),
          };
        },
      });

      const modelWithoutImageUrlSupport = new MockLanguageModelV4({
        provider: 'without-image-url-support',
        modelId: 'without-image-url-support',
        supportedUrls: {},
        doStream: async options => {
          languageModelCalls.push(options);
          return {
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              {
                type: 'text-delta',
                id: '1',
                delta: 'response from without-image-url-support',
              },
              { type: 'text-end', id: '1' },
            ]),
          };
        },
      });

      const customDownload = async (
        requestedDownloads: Array<{ url: URL; isUrlSupportedByModel: boolean }>,
      ) => {
        downloadCalls.push(...requestedDownloads);
        return requestedDownloads.map(download =>
          download.isUrlSupportedByModel
            ? null
            : {
                data: new Uint8Array([1, 2, 3, 4]),
                mediaType: 'image/png',
              },
        );
      };

      const result = streamText({
        model: modelWithImageUrlSupport,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this image' },
              { type: 'image', image: 'https://example.com/test.jpg' },
            ],
          },
        ],
        prepareStep: async () => {
          return {
            model: modelWithoutImageUrlSupport, // model switch
          };
        },
        experimental_download: customDownload,
      });

      await result.consumeStream();

      expect(downloadCalls).toMatchInlineSnapshot(`
        [
          {
            "isUrlSupportedByModel": false,
            "url": "https://example.com/test.jpg",
          },
        ]
      `);

      expect(languageModelCalls).toMatchInlineSnapshot(`
        [
          {
            "abortSignal": undefined,
            "frequencyPenalty": undefined,
            "headers": undefined,
            "includeRawChunks": false,
            "maxOutputTokens": undefined,
            "presencePenalty": undefined,
            "prompt": [
              {
                "content": [
                  {
                    "providerOptions": undefined,
                    "text": "Describe this image",
                    "type": "text",
                  },
                  {
                    "data": {
                      "data": Uint8Array [
                        1,
                        2,
                        3,
                        4,
                      ],
                      "type": "data",
                    },
                    "filename": undefined,
                    "mediaType": "image/png",
                    "providerOptions": undefined,
                    "type": "file",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
            ],
            "providerOptions": undefined,
            "reasoning": undefined,
            "responseFormat": undefined,
            "seed": undefined,
            "stopSequences": undefined,
            "temperature": undefined,
            "toolChoice": {
              "type": "auto",
            },
            "tools": undefined,
            "topK": undefined,
            "topP": undefined,
          },
        ]
      `);

      expect(await result.text).toBe('response from without-image-url-support');
    });
  });

  describe('telemetry integrations', () => {
    afterEach(() => {
      globalThis.AI_SDK_TELEMETRY_INTEGRATIONS = undefined;
    });

    it('should call per-call integration listeners for all lifecycle events', async () => {
      const events: string[] = [];

      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'testTool',
                input: '{ "value": "test" }',
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools: {
          testTool: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        onError: () => {},
        telemetry: {
          integrations: {
            onStart: async () => {
              events.push('onStart');
            },
            onStepStart: async () => {
              events.push('onStepStart');
            },
            onToolExecutionStart: async () => {
              events.push('onToolExecutionStart');
            },
            onToolExecutionEnd: async () => {
              events.push('onToolExecutionEnd');
            },
            onStepEnd: async () => {
              events.push('onStepEnd');
            },
            onEnd: async () => {
              events.push('onEnd');
            },
          },
        },
      });

      await result.consumeStream();

      expect(events).toMatchInlineSnapshot(`
        [
          "onStart",
          "onStepStart",
          "onToolExecutionStart",
          "onToolExecutionEnd",
          "onStepEnd",
          "onEnd",
        ]
      `);
    });

    it('should call globally registered integration listeners', async () => {
      const events: string[] = [];

      globalThis.AI_SDK_TELEMETRY_INTEGRATIONS = [
        {
          onStart: async () => {
            events.push('global-onStart');
          },
          onStepEnd: async () => {
            events.push('global-onStepEnd');
          },
          onEnd: async () => {
            events.push('global-onEnd');
          },
        },
      ];

      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        onError: () => {},
      });

      await result.consumeStream();

      expect(events).toEqual([
        'global-onStart',
        'global-onStepEnd',
        'global-onEnd',
      ]);
    });

    it('should only call per-call integrations when both global and per-call integrations are provided', async () => {
      const events: string[] = [];

      globalThis.AI_SDK_TELEMETRY_INTEGRATIONS = [
        {
          onStart: async () => {
            events.push('global');
          },
        },
      ];

      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        onError: () => {},
        telemetry: {
          integrations: {
            onStart: async () => {
              events.push('per-call');
            },
          },
        },
      });

      await result.consumeStream();

      expect(events).toEqual(['per-call']);
    });

    it('should call integration listeners alongside user callbacks', async () => {
      const events: string[] = [];

      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        onError: () => {},
        onStart: async () => {
          events.push('user-onStart');
        },
        onStepFinish: async () => {
          events.push('user-onStepFinish');
        },
        onFinish: async () => {
          events.push('user-onFinish');
        },
        telemetry: {
          integrations: {
            onStart: async () => {
              events.push('integration-onStart');
            },
            onStepEnd: async () => {
              events.push('integration-onStepEnd');
            },
            onEnd: async () => {
              events.push('integration-onEnd');
            },
          },
        },
      });

      await result.consumeStream();

      expect(events).toEqual([
        'user-onStart',
        'integration-onStart',
        'user-onStepFinish',
        'integration-onStepEnd',
        'user-onFinish',
        'integration-onEnd',
      ]);
    });

    it('should not break streaming when an integration listener throws', async () => {
      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        onError: () => {},
        telemetry: {
          integrations: {
            onStart: async () => {
              throw new Error('integration error');
            },
            onStepEnd: async () => {
              throw new Error('integration error');
            },
            onEnd: async () => {
              throw new Error('integration error');
            },
          },
        },
      });

      await result.consumeStream();

      expect(await result.text).toBe('Hello, world!');
    });

    it('should support multiple per-call integrations as an array', async () => {
      const events: string[] = [];

      const result = streamText({
        model: createTestModel(),
        prompt: 'test-input',
        onError: () => {},
        telemetry: {
          integrations: [
            {
              onStart: async () => {
                events.push('first');
              },
            },
            {
              onStart: async () => {
                events.push('second');
              },
            },
          ],
        },
      });

      await result.consumeStream();

      expect(events).toEqual(['first', 'second']);
    });
  });
});

async function expectUndefinedUnhandledRejections({
  count: maxCount = 1,
  fn,
}: {
  count?: number;
  fn: () => Promise<void>;
}): Promise<void> {
  const listeners = process.listeners('unhandledRejection');
  const reasons: unknown[] = [];

  process.removeAllListeners('unhandledRejection');
  process.on('unhandledRejection', reason => {
    reasons.push(reason);
  });

  try {
    await fn();
    await new Promise(resolve => setTimeout(resolve, 0));
  } finally {
    process.removeAllListeners('unhandledRejection');
    for (const listener of listeners) {
      process.on('unhandledRejection', listener);
    }
  }

  expect(reasons).toEqual(
    Array.from({ length: reasons.length }, () => undefined),
  );
  expect(reasons.length).toBeLessThanOrEqual(maxCount);
}
