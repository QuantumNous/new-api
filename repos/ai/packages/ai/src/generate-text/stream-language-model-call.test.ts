import type {
  LanguageModelV4StreamPart,
  LanguageModelV4Usage,
} from '@ai-sdk/provider';
import { tool, type ToolSet } from '@ai-sdk/provider-utils';
import {
  convertArrayToReadableStream,
  convertReadableStreamToArray,
} from '@ai-sdk/provider-utils/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { NoSuchToolError } from '../error/no-such-tool-error';
import { MockLanguageModelV4 } from '../test/mock-language-model-v4';
import type {
  LanguageModelCallEndEvent,
  LanguageModelCallStartEvent,
} from './language-model-events';
import { now } from '../util/now';
import { streamLanguageModelCall } from './stream-language-model-call';
import type { ToolCallRepairFunction } from './tool-call-repair-function';
import type { ToolInputRefinement } from './tool-input-refinement';

vi.mock('../util/now', () => ({
  now: vi.fn(() => 0),
}));

const mockNow = vi.mocked(now);

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

async function streamLanguageModelCallResult<TOOLS extends ToolSet>({
  streamParts,
  tools,
  repairToolCall,
  refineToolInput,
}: {
  streamParts: LanguageModelV4StreamPart[];
  tools: TOOLS | undefined;
  repairToolCall?: ToolCallRepairFunction<TOOLS>;
  refineToolInput?: ToolInputRefinement<TOOLS>;
}) {
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: convertArrayToReadableStream(streamParts),
    }),
  });

  const { stream } = await streamLanguageModelCall({
    model,
    tools,
    prompt: 'test prompt',
    system: undefined,
    repairToolCall,
    refineToolInput,
  });

  return convertReadableStreamToArray(stream);
}

describe('streamLanguageModelCall', () => {
  describe('model-call callbacks', () => {
    it('should call onLanguageModelCallStart before doStream', async () => {
      const callOrder: string[] = [];
      let startEvent!: LanguageModelCallStartEvent;

      await streamLanguageModelCall({
        model: new MockLanguageModelV4({
          doStream: async () => {
            callOrder.push('doStream');
            return {
              stream: convertArrayToReadableStream([
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        }),
        prompt: 'test prompt',
        maxOutputTokens: 128,
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        presencePenalty: 0.2,
        frequencyPenalty: 0.1,
        stopSequences: ['stop'],
        seed: 123,
        reasoning: 'high',
        tools: {
          testTool: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        callId: 'test-telemetry-call-id',
        onLanguageModelCallStart: async event => {
          callOrder.push('onLanguageModelCallStart');
          startEvent = event;
        },
      });

      expect(callOrder).toEqual(['onLanguageModelCallStart', 'doStream']);
      expect(startEvent).toMatchInlineSnapshot(`
        {
          "callId": "test-telemetry-call-id",
          "frequencyPenalty": 0.1,
          "instructions": undefined,
          "maxOutputTokens": 128,
          "messages": [
            {
              "content": "test prompt",
              "role": "user",
            },
          ],
          "modelId": "mock-model-id",
          "presencePenalty": 0.2,
          "provider": "mock-provider",
          "reasoning": "high",
          "seed": 123,
          "stopSequences": [
            "stop",
          ],
          "temperature": 0.7,
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
              "name": "testTool",
              "type": "function",
            },
          ],
          "topK": 40,
          "topP": 0.9,
        }
      `);
    });

    it('should generate a consistent callId when one is not provided', async () => {
      let startEvent!: LanguageModelCallStartEvent;
      let endEvent!: LanguageModelCallEndEvent;
      const generateId = vi.fn(() => 'aitxt-generated-response-id');
      const generateCallId = vi.fn(() => 'call-generated-call-id');

      const { stream } = await streamLanguageModelCall({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
        }),
        prompt: 'test prompt',
        _internal: {
          generateId,
          generateCallId,
        },
        onLanguageModelCallStart: async event => {
          startEvent = event;
        },
        onLanguageModelCallEnd: async event => {
          endEvent = event;
        },
      });

      await convertReadableStreamToArray(stream);

      expect({
        startEvent,
        endEvent,
      }).toMatchInlineSnapshot(`
        {
          "endEvent": {
            "callId": "call-generated-call-id",
            "content": [],
            "finishReason": "stop",
            "modelId": "mock-model-id",
            "performance": {
              "effectiveOutputTokensPerSecond": 0,
              "effectiveTotalTokensPerSecond": 0,
              "inputTokensPerSecond": undefined,
              "outputTokensPerSecond": undefined,
              "responseTimeMs": 0,
              "timeBetweenOutputChunksMs": undefined,
              "timeToFirstOutputMs": undefined,
            },
            "provider": "mock-provider",
            "responseId": "aitxt-generated-response-id",
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
          "startEvent": {
            "callId": "call-generated-call-id",
            "instructions": undefined,
            "messages": [
              {
                "content": "test prompt",
                "role": "user",
              },
            ],
            "modelId": "mock-model-id",
            "provider": "mock-provider",
            "tools": undefined,
          },
        }
      `);
      expect(endEvent.callId).toBe(startEvent.callId);
    });

    it('should call onLanguageModelCallEnd with parsed model-call content', async () => {
      const tools = {
        testTool: tool({
          inputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => `${value}-result`,
        }),
      };
      const modelCallEndEvents: LanguageModelCallEndEvent<typeof tools>[] = [];

      const { stream } = await streamLanguageModelCall({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'response-1',
                timestamp: new Date('2025-01-01T00:00:00.000Z'),
                modelId: 'response-model',
              },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Hello ' },
              { type: 'text-delta', id: 'text-1', delta: 'world' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'testTool',
                input: '{ "value": "hello" }',
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools,
        prompt: 'test prompt',
        callId: 'test-telemetry-call-id',
        onLanguageModelCallEnd: async event => {
          modelCallEndEvents.push(event);
        },
      });

      await convertReadableStreamToArray(stream);

      expect(modelCallEndEvents).toMatchInlineSnapshot(`
        [
          {
            "callId": "test-telemetry-call-id",
            "content": [
              {
                "text": "Hello world",
                "type": "text",
              },
              {
                "input": {
                  "value": "hello",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "testTool",
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

    it('should generate a responseId when the provider does not send one', async () => {
      let endEvent!: LanguageModelCallEndEvent;
      const generateId = vi.fn(() => 'aitxt-generated-response-id');

      const { stream } = await streamLanguageModelCall({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
        }),
        prompt: 'test prompt',
        callId: 'test-telemetry-call-id',
        _internal: {
          generateId,
        },
        onLanguageModelCallEnd: async event => {
          endEvent = event;
        },
      });

      await convertReadableStreamToArray(stream);

      expect(endEvent).toMatchInlineSnapshot(`
        {
          "callId": "test-telemetry-call-id",
          "content": [],
          "finishReason": "stop",
          "modelId": "mock-model-id",
          "performance": {
            "effectiveOutputTokensPerSecond": 0,
            "effectiveTotalTokensPerSecond": 0,
            "inputTokensPerSecond": undefined,
            "outputTokensPerSecond": undefined,
            "responseTimeMs": 0,
            "timeBetweenOutputChunksMs": undefined,
            "timeToFirstOutputMs": undefined,
          },
          "provider": "mock-provider",
          "responseId": "aitxt-generated-response-id",
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
        }
      `);
    });
  });

  describe('stream-start parts', () => {
    it('should convert stream-start to init-model-call', async () => {
      const model = new MockLanguageModelV4({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            {
              type: 'stream-start',
              warnings: [
                {
                  type: 'compatibility',
                  feature: 'tool-approval',
                  details: 'approval fallback is being used',
                },
                {
                  type: 'other',
                  message: 'custom warning',
                },
              ],
            },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        }),
      });

      const { stream } = await streamLanguageModelCall({
        model,
        tools: undefined,
        prompt: 'test prompt',
        system: undefined,
        repairToolCall: undefined,
      });

      expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
        [
          {
            "type": "model-call-start",
            "warnings": [
              {
                "details": "approval fallback is being used",
                "feature": "tool-approval",
                "type": "compatibility",
              },
              {
                "message": "custom warning",
                "type": "other",
              },
            ],
          },
          {
            "finishReason": "stop",
            "performance": {
              "effectiveOutputTokensPerSecond": 0,
              "effectiveTotalTokensPerSecond": 0,
              "inputTokensPerSecond": undefined,
              "outputTokensPerSecond": undefined,
              "responseTimeMs": 0,
              "timeBetweenOutputChunksMs": undefined,
              "timeToFirstOutputMs": undefined,
            },
            "providerMetadata": undefined,
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
    });
  });

  describe('text parts', () => {
    it('should convert text to delta', async () => {
      const result = await streamLanguageModelCallResult({
        streamParts: [
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'text' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
          },
        ],
        tools: undefined,
        repairToolCall: undefined,
      });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          {
            "id": "1",
            "providerMetadata": undefined,
            "text": "text",
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
              "timeBetweenOutputChunksMs": undefined,
              "timeToFirstOutputMs": 0,
            },
            "providerMetadata": undefined,
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
    });

    it('should measure time to first output from text deltas', async () => {
      mockNow
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1250)
        .mockReturnValueOnce(1600);

      const result = await streamLanguageModelCallResult({
        streamParts: [
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'text' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
          },
        ],
        tools: undefined,
        repairToolCall: undefined,
      });

      expect(result.at(-1)).toMatchObject({
        type: 'model-call-end',
        performance: {
          responseTimeMs: 600,
          effectiveOutputTokensPerSecond: 16.666666666666668,
          outputTokensPerSecond: 28.571428571428573,
          inputTokensPerSecond: 12,
          effectiveTotalTokensPerSecond: 21.666666666666668,
          timeToFirstOutputMs: 250,
        },
      });
    });

    it('should measure time between output chunks from text deltas', async () => {
      mockNow
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1100)
        .mockReturnValueOnce(1200)
        .mockReturnValueOnce(1500)
        .mockReturnValueOnce(1600)
        .mockReturnValueOnce(2000)
        .mockReturnValueOnce(2500)
        .mockReturnValueOnce(2500);

      const result = await streamLanguageModelCallResult({
        streamParts: [
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'a' },
          { type: 'text-delta', id: '1', delta: 'b' },
          { type: 'text-delta', id: '1', delta: 'c' },
          { type: 'text-delta', id: '1', delta: 'd' },
          { type: 'text-delta', id: '1', delta: 'e' },
          { type: 'text-delta', id: '1', delta: 'f' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
          },
        ],
        tools: undefined,
        repairToolCall: undefined,
      });

      expect(result.at(-1)).toMatchObject({
        type: 'model-call-end',
        performance: {
          timeBetweenOutputChunksMs: {
            min: 100,
            p10: 100,
            median: 300,
            avg: 280,
            p90: 500,
            max: 500,
          },
        },
      });
    });

    it('should measure time between all output chunk types', async () => {
      const tools = {
        testTool: tool({
          inputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => `${value}-result`,
        }),
      };

      mockNow
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1100)
        .mockReturnValueOnce(1300)
        .mockReturnValueOnce(1600)
        .mockReturnValueOnce(2000)
        .mockReturnValueOnce(2500);

      const result = await streamLanguageModelCallResult({
        streamParts: [
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'text' },
          {
            type: 'file',
            data: { type: 'data', data: 'ZmlsZQ==' },
            mediaType: 'text/plain',
          },
          {
            type: 'reasoning-file',
            data: { type: 'data', data: 'cmVhc29uaW5n' },
            mediaType: 'text/plain',
          },
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'testTool',
            input: `{ "value": "test" }`,
          },
          {
            type: 'finish',
            finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
            usage: testUsage,
          },
        ],
        tools,
        repairToolCall: undefined,
      });

      expect(result.at(-1)).toMatchObject({
        type: 'model-call-end',
        performance: {
          timeToFirstOutputMs: 100,
          timeBetweenOutputChunksMs: {
            min: 200,
            p10: 200,
            median: 300,
            avg: 300,
            p90: 400,
            max: 400,
          },
        },
      });
    });
  });

  describe('reasoning parts', () => {
    it('should convert text to delta', async () => {
      const result = await streamLanguageModelCallResult({
        streamParts: [
          { type: 'reasoning-start', id: '1' },
          { type: 'reasoning-delta', id: '1', delta: 'text' },
          { type: 'reasoning-end', id: '1' },
        ],
        tools: undefined,
        repairToolCall: undefined,
      });

      expect(result).toMatchInlineSnapshot(`
      [
        {
          "id": "1",
          "type": "reasoning-start",
        },
        {
          "id": "1",
          "providerMetadata": undefined,
          "text": "text",
          "type": "reasoning-delta",
        },
        {
          "id": "1",
          "type": "reasoning-end",
        },
      ]
    `);
    });

    it('should measure time to first output from reasoning-file parts', async () => {
      mockNow
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1250)
        .mockReturnValueOnce(1600);

      const result = await streamLanguageModelCallResult({
        streamParts: [
          {
            type: 'reasoning-file',
            data: { type: 'data', data: 'cmVhc29uaW5n' },
            mediaType: 'text/plain',
          },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
          },
        ],
        tools: undefined,
        repairToolCall: undefined,
      });

      expect(result.at(-1)).toMatchObject({
        type: 'model-call-end',
        performance: {
          responseTimeMs: 600,
          effectiveOutputTokensPerSecond: 16.666666666666668,
          outputTokensPerSecond: 28.571428571428573,
          inputTokensPerSecond: 12,
          effectiveTotalTokensPerSecond: 21.666666666666668,
          timeToFirstOutputMs: 250,
        },
      });
    });
  });

  describe('file parts', () => {
    it('should use GeneratedFile', async () => {
      const result = await streamLanguageModelCallResult({
        streamParts: [
          {
            type: 'file',
            data: { type: 'data', data: 'SGVsbG8gV29ybGQ=' }, // "Hello World" base64-encoded
            mediaType: 'text/plain',
          },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
          },
        ],
        tools: undefined,
        repairToolCall: undefined,
      });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "file": DefaultGeneratedFileWithType {
              "base64Data": "SGVsbG8gV29ybGQ=",
              "mediaType": "text/plain",
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
              "timeBetweenOutputChunksMs": undefined,
              "timeToFirstOutputMs": 0,
            },
            "providerMetadata": undefined,
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
    });

    it('should use GeneratedFile with providerMetadata', async () => {
      const result = await streamLanguageModelCallResult({
        streamParts: [
          {
            type: 'file',
            data: {
              type: 'data',
              data: new Uint8Array([
                72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100,
              ]),
            }, // "Hello World" as Uint8Array
            mediaType: 'text/plain',
            providerMetadata: {
              testProvider: { signature: 'test-signature' },
            },
          },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
          },
        ],
        tools: undefined,
        repairToolCall: undefined,
      });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "file": DefaultGeneratedFileWithType {
              "base64Data": undefined,
              "mediaType": "text/plain",
              "type": "file",
              "uint8ArrayData": Uint8Array [
                72,
                101,
                108,
                108,
                111,
                32,
                87,
                111,
                114,
                108,
                100,
              ],
            },
            "providerMetadata": {
              "testProvider": {
                "signature": "test-signature",
              },
            },
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
              "timeBetweenOutputChunksMs": undefined,
              "timeToFirstOutputMs": 0,
            },
            "providerMetadata": undefined,
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
    });

    it('should measure time to first output from file parts', async () => {
      mockNow
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1250)
        .mockReturnValueOnce(1600);

      const result = await streamLanguageModelCallResult({
        streamParts: [
          {
            type: 'file',
            data: { type: 'data', data: 'SGVsbG8gV29ybGQ=' },
            mediaType: 'text/plain',
          },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
          },
        ],
        tools: undefined,
        repairToolCall: undefined,
      });

      expect(result.at(-1)).toMatchObject({
        type: 'model-call-end',
        performance: {
          responseTimeMs: 600,
          effectiveOutputTokensPerSecond: 16.666666666666668,
          outputTokensPerSecond: 28.571428571428573,
          inputTokensPerSecond: 12,
          effectiveTotalTokensPerSecond: 21.666666666666668,
          timeToFirstOutputMs: 250,
        },
      });
    });
  });

  describe('custom parts', () => {
    it('should forward custom parts', async () => {
      const result = await streamLanguageModelCallResult({
        streamParts: [
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
        ],
        tools: undefined,
        repairToolCall: undefined,
      });

      expect(result).toMatchInlineSnapshot(`
        [
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
              "inputTokensPerSecond": undefined,
              "outputTokensPerSecond": undefined,
              "responseTimeMs": 0,
              "timeBetweenOutputChunksMs": undefined,
              "timeToFirstOutputMs": undefined,
            },
            "providerMetadata": undefined,
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
    });
  });

  describe('tool-call parts', () => {
    it('should measure time to first output from tool-call parts', async () => {
      const tools = {
        testTool: tool({
          inputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => `${value}-result`,
        }),
      };

      mockNow
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1250)
        .mockReturnValueOnce(1600);

      const result = await streamLanguageModelCallResult({
        streamParts: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'testTool',
            input: `{ "value": "test" }`,
          },
          {
            type: 'finish',
            finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
            usage: testUsage,
          },
        ],
        tools,
        repairToolCall: undefined,
      });

      expect(result.at(-1)).toMatchObject({
        type: 'model-call-end',
        performance: {
          responseTimeMs: 600,
          effectiveOutputTokensPerSecond: 16.666666666666668,
          outputTokensPerSecond: 28.571428571428573,
          inputTokensPerSecond: 12,
          effectiveTotalTokensPerSecond: 21.666666666666668,
          timeToFirstOutputMs: 250,
        },
      });
    });

    it('should refine tool call input before emitting tool-call parts and model-call end content', async () => {
      const tools = {
        testTool: tool({
          inputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => `${value}-result`,
        }),
      };
      const modelCallEndEvents: LanguageModelCallEndEvent<typeof tools>[] = [];

      const { stream } = await streamLanguageModelCall({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'testTool',
                input: '{ "value": " raw " }',
              },
              {
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: undefined },
                usage: testUsage,
              },
            ]),
          }),
        }),
        tools,
        prompt: 'test prompt',
        refineToolInput: {
          testTool: input => ({ value: input.value.trim() }),
        },
        onLanguageModelCallEnd: event => {
          modelCallEndEvents.push(event);
        },
      });

      const result = await convertReadableStreamToArray(stream);

      expect(result[0]).toMatchObject({
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'testTool',
        input: { value: 'raw' },
      });
      expect(modelCallEndEvents[0].content[0]).toMatchObject({
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'testTool',
        input: { value: 'raw' },
      });
    });

    it('should try to repair tool call when the tool name is not found', async () => {
      const tools = {
        correctTool: tool({
          inputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => `${value}-result`,
        }),
      };

      const result = await streamLanguageModelCallResult({
        streamParts: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'unknownTool',
            input: `{ "value": "test" }`,
          },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
          },
        ],
        tools,
        repairToolCall: async ({ toolCall, error }) => {
          expect(NoSuchToolError.isInstance(error)).toBe(true);
          expect(toolCall).toStrictEqual({
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'unknownTool',
            input: `{ "value": "test" }`,
          });

          return { ...toolCall, toolName: 'correctTool' };
        },
      });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "input": {
              "value": "test",
            },
            "providerExecuted": undefined,
            "providerMetadata": undefined,
            "title": undefined,
            "toolCallId": "call-1",
            "toolName": "correctTool",
            "type": "tool-call",
          },
          {
            "finishReason": "stop",
            "performance": {
              "effectiveOutputTokensPerSecond": 0,
              "effectiveTotalTokensPerSecond": 0,
              "inputTokensPerSecond": 0,
              "outputTokensPerSecond": 0,
              "responseTimeMs": 0,
              "timeBetweenOutputChunksMs": undefined,
              "timeToFirstOutputMs": 0,
            },
            "providerMetadata": undefined,
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
    });
  });

  describe('tool-approval-request parts', () => {
    it('should emit error when tool call is not found for provider approval request', async () => {
      const result = await streamLanguageModelCallResult({
        streamParts: [
          // No tool-call part before the approval request
          {
            type: 'tool-approval-request',
            approvalId: 'mcp-approval-1',
            toolCallId: 'non-existent-call',
          },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: undefined },
            usage: testUsage,
          },
        ],
        tools: undefined,
        repairToolCall: undefined,
      });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "error": [AI_ToolCallNotFoundForApprovalError: Tool call "non-existent-call" not found for approval request "mcp-approval-1".],
            "type": "error",
          },
          {
            "finishReason": "stop",
            "performance": {
              "effectiveOutputTokensPerSecond": 0,
              "effectiveTotalTokensPerSecond": 0,
              "inputTokensPerSecond": undefined,
              "outputTokensPerSecond": undefined,
              "responseTimeMs": 0,
              "timeBetweenOutputChunksMs": undefined,
              "timeToFirstOutputMs": undefined,
            },
            "providerMetadata": undefined,
            "rawFinishReason": undefined,
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
    });

    it('should forward provider-emitted tool-approval-request with the correct tool call', async () => {
      const tools = {
        mcp_tool: tool({
          type: 'provider',
          isProviderExecuted: true,
          id: 'mcp.mcp_tool',
          inputSchema: z.object({ query: z.string() }),
          args: {},
        }),
      };

      const result = await streamLanguageModelCallResult({
        streamParts: [
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
        ],
        tools,
        repairToolCall: undefined,
      });

      expect(result).toMatchInlineSnapshot(`
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
          {
            "finishReason": "tool-calls",
            "performance": {
              "effectiveOutputTokensPerSecond": 0,
              "effectiveTotalTokensPerSecond": 0,
              "inputTokensPerSecond": 0,
              "outputTokensPerSecond": 0,
              "responseTimeMs": 0,
              "timeBetweenOutputChunksMs": undefined,
              "timeToFirstOutputMs": 0,
            },
            "providerMetadata": undefined,
            "rawFinishReason": undefined,
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
    });

    it('should handle multiple provider-executed tool calls with approval requests', async () => {
      const tools = {
        mcp_search: tool({
          type: 'provider',
          isProviderExecuted: true,
          id: 'mcp.mcp_search',
          inputSchema: z.object({ query: z.string() }),
          args: {},
        }),
        mcp_execute: tool({
          type: 'provider',
          isProviderExecuted: true,
          id: 'mcp.mcp_execute',
          inputSchema: z.object({ command: z.string() }),
          args: {},
        }),
      };

      const result = await streamLanguageModelCallResult({
        streamParts: [
          {
            type: 'tool-call',
            toolCallId: 'mcp-call-1',
            toolName: 'mcp_search',
            input: `{ "query": "first" }`,
            providerExecuted: true,
          },
          {
            type: 'tool-call',
            toolCallId: 'mcp-call-2',
            toolName: 'mcp_execute',
            input: `{ "command": "ls" }`,
            providerExecuted: true,
          },
          {
            type: 'tool-approval-request',
            approvalId: 'approval-1',
            toolCallId: 'mcp-call-1',
          },
          {
            type: 'tool-approval-request',
            approvalId: 'approval-2',
            toolCallId: 'mcp-call-2',
          },
          {
            type: 'finish',
            finishReason: { unified: 'tool-calls', raw: undefined },
            usage: testUsage,
          },
        ],
        tools,
        repairToolCall: undefined,
      });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "input": {
              "query": "first",
            },
            "providerExecuted": true,
            "providerMetadata": undefined,
            "title": undefined,
            "toolCallId": "mcp-call-1",
            "toolName": "mcp_search",
            "type": "tool-call",
          },
          {
            "input": {
              "command": "ls",
            },
            "providerExecuted": true,
            "providerMetadata": undefined,
            "title": undefined,
            "toolCallId": "mcp-call-2",
            "toolName": "mcp_execute",
            "type": "tool-call",
          },
          {
            "approvalId": "approval-1",
            "toolCall": {
              "input": {
                "query": "first",
              },
              "providerExecuted": true,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "mcp-call-1",
              "toolName": "mcp_search",
              "type": "tool-call",
            },
            "type": "tool-approval-request",
          },
          {
            "approvalId": "approval-2",
            "toolCall": {
              "input": {
                "command": "ls",
              },
              "providerExecuted": true,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "mcp-call-2",
              "toolName": "mcp_execute",
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
            "providerMetadata": undefined,
            "rawFinishReason": undefined,
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
    });
  });
});
