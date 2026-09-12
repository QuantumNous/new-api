import type { EmbeddingModelV2 } from '@ai-sdk/provider';
import { asEmbeddingModelV3 } from './as-embedding-model-v3';
import { MockEmbeddingModelV2 } from '../test/mock-embedding-model-v2';
import { MockEmbeddingModelV3 } from '../test/mock-embedding-model-v3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logWarningsModule from '../logger/log-warnings';

describe('asEmbeddingModelV3', () => {
  let logWarningSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logWarningSpy = vi
      .spyOn(logWarningsModule, 'logWarnings')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    logWarningSpy.mockRestore();
  });

  describe('when an embedding model v3 is provided', () => {
    it('should return the same v3 model unchanged', () => {
      const originalModel = new MockEmbeddingModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asEmbeddingModelV3(originalModel);

      expect(result).toBe(originalModel);
      expect(result.specificationVersion).toBe('v3');
    });

    it('should not log any warning', () => {
      const originalModel = new MockEmbeddingModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      asEmbeddingModelV3(originalModel);

      expect(logWarningSpy).not.toHaveBeenCalled();
    });

    it('should preserve all v3 model properties', () => {
      const originalModel = new MockEmbeddingModelV3({
        provider: 'test-provider-v3',
        modelId: 'test-model-v3',
        maxEmbeddingsPerCall: 10,
        supportsParallelCalls: true,
      });

      const result = asEmbeddingModelV3(originalModel);

      expect(result.provider).toBe('test-provider-v3');
      expect(result.modelId).toBe('test-model-v3');
      expect(result.maxEmbeddingsPerCall).toBe(10);
      expect(result.supportsParallelCalls).toBe(true);
      expect(result.specificationVersion).toBe('v3');
    });
  });

  describe('when an embedding model v2 is provided', () => {
    it('should convert v2 to v3 and change specificationVersion', () => {
      const v2Model = new MockEmbeddingModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asEmbeddingModelV3(v2Model);

      expect(result.specificationVersion).toBe('v3');
      expect(result).not.toBe(v2Model);
    });

    it('should log a compatibility warning', () => {
      const v2Model = new MockEmbeddingModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      asEmbeddingModelV3(v2Model);

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
      const v2Model = new MockEmbeddingModelV2({
        provider: 'test-provider-v2',
        modelId: 'test-model-id',
      });

      const result = asEmbeddingModelV3(v2Model);

      expect(result.provider).toBe('test-provider-v2');
    });

    it('should preserve modelId property', () => {
      const v2Model = new MockEmbeddingModelV2({
        provider: 'test-provider',
        modelId: 'test-model-v2',
      });

      const result = asEmbeddingModelV3(v2Model);

      expect(result.modelId).toBe('test-model-v2');
    });

    it('should preserve maxEmbeddingsPerCall property', () => {
      const v2Model = new MockEmbeddingModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        maxEmbeddingsPerCall: 5,
      });

      const result = asEmbeddingModelV3(v2Model);

      expect(result.maxEmbeddingsPerCall).toBe(5);
    });

    it('should preserve maxEmbeddingsPerCall as undefined', () => {
      const v2Model = new MockEmbeddingModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        maxEmbeddingsPerCall: null,
      });

      const result = asEmbeddingModelV3(v2Model);

      expect(result.maxEmbeddingsPerCall).toBeUndefined();
    });

    it('should preserve supportsParallelCalls property', () => {
      const v2Model = new MockEmbeddingModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        supportsParallelCalls: true,
      });

      const result = asEmbeddingModelV3(v2Model);

      expect(result.supportsParallelCalls).toBe(true);
    });

    it('should preserve supportsParallelCalls as promise', async () => {
      const v2Model = new MockEmbeddingModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        supportsParallelCalls: Promise.resolve(true),
      });

      const result = asEmbeddingModelV3(v2Model);

      expect(await result.supportsParallelCalls).toBe(true);
    });

    it('should make doEmbed method callable', async () => {
      const v2Model = new MockEmbeddingModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doEmbed: async () => ({
          embeddings: [[0.1, 0.2, 0.3]],
        }),
      });

      const result = asEmbeddingModelV3(v2Model);

      const response = await result.doEmbed({
        values: ['test text'],
      });

      expect(response.embeddings).toHaveLength(1);
      expect(response.embeddings[0]).toEqual([0.1, 0.2, 0.3]);
    });

    it('should handle doEmbed with multiple embeddings', async () => {
      const v2Model = new MockEmbeddingModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doEmbed: async () => ({
          embeddings: [
            [0.1, 0.2, 0.3],
            [0.4, 0.5, 0.6],
          ],
        }),
      });

      const result = asEmbeddingModelV3(v2Model);

      const response = await result.doEmbed({
        values: ['text one', 'text two'],
      });

      expect(response.embeddings).toHaveLength(2);
      expect(response.embeddings[0]).toEqual([0.1, 0.2, 0.3]);
      expect(response.embeddings[1]).toEqual([0.4, 0.5, 0.6]);
    });

    it('should handle doEmbed with usage information', async () => {
      const v2Model = new MockEmbeddingModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doEmbed: async () => ({
          embeddings: [[0.1, 0.2, 0.3]],
          usage: { tokens: 50 },
        }),
      });

      const result = asEmbeddingModelV3(v2Model);

      const response = await result.doEmbed({
        values: ['test text'],
      });

      expect(response.usage?.tokens).toBe(50);
    });

    it('should handle doEmbed with provider metadata', async () => {
      const v2Model = new MockEmbeddingModelV2<string>({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doEmbed: async () => ({
          embeddings: [[0.1, 0.2, 0.3]],
          providerMetadata: {
            testProvider: { customField: 'value' },
          },
        }),
      });

      const result = asEmbeddingModelV3(v2Model);

      const response = await result.doEmbed({
        values: ['test text'],
      });

      expect(response.providerMetadata?.testProvider).toEqual({
        customField: 'value',
      });
    });

    it('should handle doEmbed with response headers', async () => {
      const v2Model = new MockEmbeddingModelV2<string>({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doEmbed: async () => ({
          embeddings: [[0.1, 0.2, 0.3]],
          response: {
            headers: { 'x-custom': 'header-value' },
          },
        }),
      });

      const result = asEmbeddingModelV3(v2Model);

      const response = await result.doEmbed({
        values: ['test text'],
      });

      expect(response.response?.headers).toEqual({
        'x-custom': 'header-value',
      });
    });

    it('should handle doEmbed with response body', async () => {
      const v2Model = new MockEmbeddingModelV2<string>({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doEmbed: async () => ({
          embeddings: [[0.1, 0.2, 0.3]],
          response: {
            body: { raw: 'response data' },
          },
        }),
      });

      const result = asEmbeddingModelV3(v2Model);

      const response = await result.doEmbed({
        values: ['test text'],
      });

      expect(response.response?.body).toEqual({ raw: 'response data' });
    });

    it('should preserve prototype methods when using class instances', async () => {
      class TestEmbeddingModelV2 implements EmbeddingModelV2<string> {
        readonly specificationVersion = 'v2' as const;
        readonly provider = 'test-provider';
        readonly modelId = 'test-model-id';
        readonly maxEmbeddingsPerCall = 1;
        readonly supportsParallelCalls = false;

        customMethod() {
          return 'custom-value';
        }

        async doEmbed() {
          return { embeddings: [[0.1, 0.2, 0.3]] };
        }
      }

      const v2Model = new TestEmbeddingModelV2();
      const result = asEmbeddingModelV3(v2Model) as any;

      expect(result.customMethod()).toBe('custom-value');
      expect(result.specificationVersion).toBe('v3');
    });
  });
});
