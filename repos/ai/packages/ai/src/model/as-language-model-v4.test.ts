import {
  convertArrayToReadableStream,
  convertReadableStreamToArray,
} from '@ai-sdk/provider-utils/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logWarningsModule from '../logger/log-warnings';
import { MockLanguageModelV2 } from '../test/mock-language-model-v2';
import { MockLanguageModelV3 } from '../test/mock-language-model-v3';
import { MockLanguageModelV4 } from '../test/mock-language-model-v4';
import { asLanguageModelV4 } from './as-language-model-v4';

describe('asLanguageModelV4', () => {
  let logWarningSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logWarningSpy = vi
      .spyOn(logWarningsModule, 'logWarnings')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    logWarningSpy.mockRestore();
  });

  describe('when a language model v4 is provided', () => {
    it('should return the same v4 model unchanged', () => {
      const originalModel = new MockLanguageModelV4({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asLanguageModelV4(originalModel);

      expect(result).toBe(originalModel);
      expect(result.specificationVersion).toBe('v4');
    });

    it('should preserve all v4 model properties', () => {
      const originalModel = new MockLanguageModelV4({
        provider: 'test-provider-v4',
        modelId: 'test-model-v4',
        supportedUrls: { 'image/*': [/^https:\/\/test\.com/] },
      });

      const result = asLanguageModelV4(originalModel);

      expect(result.provider).toBe('test-provider-v4');
      expect(result.modelId).toBe('test-model-v4');
      expect(result.specificationVersion).toBe('v4');
    });
  });

  describe('when a language model v3 is provided', () => {
    it('should convert v3 to v4 and change specificationVersion', () => {
      const v3Model = new MockLanguageModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asLanguageModelV4(v3Model);

      expect(result.specificationVersion).toBe('v4');
      expect(result).not.toBe(v3Model);
    });

    it('should preserve provider property', () => {
      const v3Model = new MockLanguageModelV3({
        provider: 'test-provider-v3',
        modelId: 'test-model-id',
      });

      const result = asLanguageModelV4(v3Model);

      expect(result.provider).toBe('test-provider-v3');
    });

    it('should preserve modelId property', () => {
      const v3Model = new MockLanguageModelV3({
        provider: 'test-provider',
        modelId: 'test-model-v3',
      });

      const result = asLanguageModelV4(v3Model);

      expect(result.modelId).toBe('test-model-v3');
    });

    it('should make doGenerate method callable', async () => {
      const v3Model = new MockLanguageModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          content: [{ type: 'text' as const, text: 'Hello' }],
          finishReason: {
            unified: 'stop' as const,
            raw: undefined,
          },
          usage: {
            inputTokens: {
              total: 10,
              noCache: undefined,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: 5,
              text: undefined,
              reasoning: undefined,
            },
          },
          warnings: [],
        }),
      });

      const result = asLanguageModelV4(v3Model);

      const response = await result.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
      });

      expect(response.content).toHaveLength(1);
      expect(response.finishReason.unified).toBe('stop');
    });

    it('should make doStream method callable', async () => {
      const v3Model = new MockLanguageModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'text-start' as const, id: '1' },
            { type: 'text-delta' as const, id: '1', delta: 'Hello' },
            { type: 'text-end' as const, id: '1' },
            {
              type: 'finish' as const,
              finishReason: {
                unified: 'stop' as const,
                raw: undefined,
              },
              usage: {
                inputTokens: {
                  total: 3,
                  noCache: undefined,
                  cacheRead: undefined,
                  cacheWrite: undefined,
                },
                outputTokens: {
                  total: 5,
                  text: undefined,
                  reasoning: undefined,
                },
              },
            },
          ]),
        }),
      });

      const result = asLanguageModelV4(v3Model);

      const { stream } = await result.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
      });

      const parts = await convertReadableStreamToArray(stream);
      expect(parts).toHaveLength(4);
      expect(parts[0].type).toBe('text-start');
    });
  });

  describe('when a language model v2 is provided', () => {
    it('should convert v2 through v3 to v4', () => {
      const v2Model = new MockLanguageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asLanguageModelV4(v2Model);

      expect(result.specificationVersion).toBe('v4');
      expect(result.provider).toBe('test-provider');
      expect(result.modelId).toBe('test-model-id');
    });

    it('should make doGenerate method callable', async () => {
      const v2Model = new MockLanguageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          content: [{ type: 'text' as const, text: 'Hello' }],
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          warnings: [],
        }),
      });

      const result = asLanguageModelV4(v2Model);

      const response = await result.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
      });

      expect(response.content).toHaveLength(1);
    });
  });
});
