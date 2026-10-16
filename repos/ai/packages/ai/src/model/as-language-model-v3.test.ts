import type { LanguageModelV2 } from '@ai-sdk/provider';
import {
  convertArrayToReadableStream,
  convertReadableStreamToArray,
} from '@ai-sdk/provider-utils/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logWarningsModule from '../logger/log-warnings';
import { MockLanguageModelV2 } from '../test/mock-language-model-v2';
import { MockLanguageModelV3 } from '../test/mock-language-model-v3';
import { asLanguageModelV3 } from './as-language-model-v3';

describe('asLanguageModelV3', () => {
  let logWarningSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logWarningSpy = vi
      .spyOn(logWarningsModule, 'logWarnings')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    logWarningSpy.mockRestore();
  });

  describe('when a language model v3 is provided', () => {
    it('should return the same v3 model unchanged', () => {
      const originalModel = new MockLanguageModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asLanguageModelV3(originalModel);

      expect(result).toBe(originalModel);
      expect(result.specificationVersion).toBe('v3');
    });

    it('should not log any warning', () => {
      const originalModel = new MockLanguageModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      asLanguageModelV3(originalModel);

      expect(logWarningSpy).not.toHaveBeenCalled();
    });

    it('should preserve all v3 model properties', () => {
      const originalModel = new MockLanguageModelV3({
        provider: 'test-provider-v3',
        modelId: 'test-model-v3',
        supportedUrls: { 'image/*': [/^https:\/\/test\.com/] },
      });

      const result = asLanguageModelV3(originalModel);

      expect(result.provider).toBe('test-provider-v3');
      expect(result.modelId).toBe('test-model-v3');
      expect(result.specificationVersion).toBe('v3');
    });
  });

  describe('when a language model v2 is provided', () => {
    it('should convert v2 to v3 and change specificationVersion', () => {
      const v2Model = new MockLanguageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asLanguageModelV3(v2Model);

      expect(result.specificationVersion).toBe('v3');
      expect(result).not.toBe(v2Model);
    });

    it('should log a compatibility warning', () => {
      const v2Model = new MockLanguageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      asLanguageModelV3(v2Model);

      expect(logWarningSpy).toHaveBeenCalledWith({
        warnings: [
          {
            type: 'compatibility',
            feature: 'specificationVersion',
            details: expect.stringContaining(
              'Using v2 specification compatibility',
            ),
          },
        ],
        provider: 'test-provider',
        model: 'test-model-id',
      });
    });

    it('should preserve provider property', () => {
      const v2Model = new MockLanguageModelV2({
        provider: 'test-provider-v2',
        modelId: 'test-model-id',
      });

      const result = asLanguageModelV3(v2Model);

      expect(result.provider).toBe('test-provider-v2');
    });

    it('should preserve modelId property', () => {
      const v2Model = new MockLanguageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-v2',
      });

      const result = asLanguageModelV3(v2Model);

      expect(result.modelId).toBe('test-model-v2');
    });

    it('should preserve supportedUrls property', async () => {
      const supportedUrls = { 'audio/*': [/^https:\/\/example\.com/] };
      const v2Model = new MockLanguageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        supportedUrls,
      });

      const result = asLanguageModelV3(v2Model);

      expect(await result.supportedUrls).toEqual(supportedUrls);
    });

    it('should preserve supportedUrls as promise', async () => {
      const supportedUrls = { 'video/*': [/^https:\/\/videos\.com/] };
      const v2Model = new MockLanguageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        supportedUrls: () => Promise.resolve(supportedUrls),
      });

      const result = asLanguageModelV3(v2Model);

      expect(await result.supportedUrls).toEqual(supportedUrls);
    });

    it('should make doGenerate method callable', async () => {
      const v2Model = new MockLanguageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          content: [{ type: 'text', text: 'Hello' }],
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          warnings: [],
        }),
      });

      const result = asLanguageModelV3(v2Model);

      const response = await result.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
      });

      expect(response).toMatchInlineSnapshot(`
        {
          "content": [
            {
              "text": "Hello",
              "type": "text",
            },
          ],
          "finishReason": {
            "raw": undefined,
            "unified": "stop",
          },
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": undefined,
              "total": 10,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": undefined,
              "total": 5,
            },
          },
          "warnings": [],
        }
      `);
    });

    describe('doStream', () => {
      it('should convert v2 stream to v3 stream', async () => {
        const v2Model = new MockLanguageModelV2({
          doStream: async ({ prompt }) => {
            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', ' },
                { type: 'text-delta', id: '1', delta: `world!` },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: {
                    inputTokens: 3,
                    outputTokens: 10,
                    totalTokens: 13,
                    reasoningTokens: 2,
                    cachedInputTokens: 4,
                  },
                },
              ]),
            };
          },
        });

        const { stream } = await asLanguageModelV3(v2Model).doStream({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
        });

        expect(await convertReadableStreamToArray(stream))
          .toMatchInlineSnapshot(`
            [
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
                "finishReason": {
                  "raw": undefined,
                  "unified": "stop",
                },
                "type": "finish",
                "usage": {
                  "inputTokens": {
                    "cacheRead": 4,
                    "cacheWrite": undefined,
                    "noCache": undefined,
                    "total": 3,
                  },
                  "outputTokens": {
                    "reasoning": 2,
                    "text": undefined,
                    "total": 10,
                  },
                },
              },
            ]
          `);
      });
    });

    it('should preserve prototype methods when using class instances', async () => {
      class TestLanguageModelV2 implements LanguageModelV2 {
        readonly specificationVersion = 'v2' as const;
        readonly provider = 'test-provider';
        readonly modelId = 'test-model-id';
        readonly supportedUrls = {};

        customMethod() {
          return 'custom-value';
        }

        async doGenerate() {
          return {
            content: [],
            finishReason: 'stop' as const,
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            warnings: [],
          };
        }

        async doStream() {
          return { stream: new ReadableStream() };
        }
      }

      const v2Model = new TestLanguageModelV2();
      const result = asLanguageModelV3(v2Model) as any;

      expect(result.customMethod()).toBe('custom-value');
      expect(result.specificationVersion).toBe('v3');
    });

    it('should handle model with request/response metadata in doGenerate', async () => {
      const v2Model = new MockLanguageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          content: [{ type: 'text', text: 'Response' }],
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          warnings: [],
          request: { body: { prompt: 'test' } },
          response: {
            id: 'resp-123',
            timestamp: new Date(),
            headers: { 'x-custom': 'value' },
            body: { response: 'data' },
          },
        }),
      });

      const result = asLanguageModelV3(v2Model);

      const response = await result.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
      });

      expect(response.request?.body).toBeDefined();
      expect(response.response?.headers).toBeDefined();
    });

    it('should handle model with provider metadata', async () => {
      const v2Model = new MockLanguageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          content: [{ type: 'text', text: 'Response' }],
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          warnings: [],
          providerMetadata: {
            testProvider: { customField: 'value' },
          },
        }),
      });

      const result = asLanguageModelV3(v2Model);

      const response = await result.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
      });

      expect(response.providerMetadata?.testProvider).toEqual({
        customField: 'value',
      });
    });

    it('should handle model with warnings', async () => {
      const v2Model = new MockLanguageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          content: [{ type: 'text', text: 'Response' }],
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          warnings: [
            {
              type: 'unsupported-setting',
              setting: 'temperature',
              details: 'Temperature not supported',
            },
          ],
        }),
      });

      const result = asLanguageModelV3(v2Model);

      const response = await result.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
      });

      expect(response.warnings).toHaveLength(1);
      expect(response.warnings[0].type).toBe('unsupported-setting');
    });

    it('should handle response with reasoning tokens in usage', async () => {
      const v2Model = new MockLanguageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          content: [{ type: 'text', text: 'Response' }],
          finishReason: 'stop',
          usage: {
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 20,
            reasoningTokens: 5,
          },
          warnings: [],
        }),
      });

      const result = asLanguageModelV3(v2Model);

      const response = await result.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
      });

      expect(response.usage?.outputTokens?.reasoning).toBe(5);
    });

    it('should handle response with cached input tokens in usage', async () => {
      const v2Model = new MockLanguageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          content: [{ type: 'text', text: 'Response' }],
          finishReason: 'stop',
          usage: {
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15,
            cachedInputTokens: 8,
          },
          warnings: [],
        }),
      });

      const result = asLanguageModelV3(v2Model);

      const response = await result.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
      });

      expect(response.usage?.inputTokens?.cacheRead).toBe(8);
    });

    it('should handle response with different finish reasons', async () => {
      const finishReasons: Array<
        | 'stop'
        | 'length'
        | 'content-filter'
        | 'tool-calls'
        | 'error'
        | 'other'
        | 'unknown'
      > = [
        'stop',
        'length',
        'content-filter',
        'tool-calls',
        'error',
        'other',
        'unknown',
      ];

      for (const finishReason of finishReasons) {
        const v2Model = new MockLanguageModelV2({
          provider: 'test-provider',
          modelId: 'test-model-id',
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'Response' }],
            finishReason,
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            warnings: [],
          }),
        });

        const result = asLanguageModelV3(v2Model);

        const response = await result.doGenerate({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
        });

        expect(response.finishReason).toStrictEqual({
          raw: undefined,
          unified: finishReason === 'unknown' ? 'other' : finishReason,
        });
      }
    });

    it('should handle doStream with response headers', async () => {
      const v2Model = new MockLanguageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doStream: async () => ({
          stream: new ReadableStream(),
          response: {
            headers: { 'x-custom': 'stream-header' },
          },
        }),
      });

      const result = asLanguageModelV3(v2Model);

      const { response } = await result.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
      });

      expect(response?.headers).toEqual({ 'x-custom': 'stream-header' });
    });
  });
});
