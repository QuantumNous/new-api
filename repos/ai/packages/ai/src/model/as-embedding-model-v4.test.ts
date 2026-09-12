import { describe, expect, it } from 'vitest';
import { MockEmbeddingModelV2 } from '../test/mock-embedding-model-v2';
import { MockEmbeddingModelV3 } from '../test/mock-embedding-model-v3';
import { MockEmbeddingModelV4 } from '../test/mock-embedding-model-v4';
import { asEmbeddingModelV4 } from './as-embedding-model-v4';

describe('asEmbeddingModelV4', () => {
  describe('when an embedding model v4 is provided', () => {
    it('should return the same v4 model unchanged', () => {
      const originalModel = new MockEmbeddingModelV4({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asEmbeddingModelV4(originalModel);

      expect(result).toBe(originalModel);
      expect(result.specificationVersion).toBe('v4');
    });

    it('should preserve all v4 model properties', () => {
      const originalModel = new MockEmbeddingModelV4({
        provider: 'test-provider-v4',
        modelId: 'test-model-v4',
        maxEmbeddingsPerCall: 10,
        supportsParallelCalls: true,
      });

      const result = asEmbeddingModelV4(originalModel);

      expect(result.provider).toBe('test-provider-v4');
      expect(result.modelId).toBe('test-model-v4');
      expect(result.maxEmbeddingsPerCall).toBe(10);
      expect(result.supportsParallelCalls).toBe(true);
    });
  });

  describe('when an embedding model v3 is provided', () => {
    it('should convert v3 to v4 and change specificationVersion', () => {
      const v3Model = new MockEmbeddingModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asEmbeddingModelV4(v3Model);

      expect(result.specificationVersion).toBe('v4');
      expect(result).not.toBe(v3Model);
    });

    it('should preserve provider property', () => {
      const v3Model = new MockEmbeddingModelV3({
        provider: 'test-provider-v3',
        modelId: 'test-model-id',
      });

      const result = asEmbeddingModelV4(v3Model);

      expect(result.provider).toBe('test-provider-v3');
    });

    it('should preserve modelId property', () => {
      const v3Model = new MockEmbeddingModelV3({
        provider: 'test-provider',
        modelId: 'test-model-v3',
      });

      const result = asEmbeddingModelV4(v3Model);

      expect(result.modelId).toBe('test-model-v3');
    });

    it('should make doEmbed method callable', async () => {
      const v3Model = new MockEmbeddingModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doEmbed: async () => ({
          embeddings: [[0.1, 0.2, 0.3]],
          warnings: [],
        }),
      });

      const result = asEmbeddingModelV4(v3Model);

      const response = await result.doEmbed({ values: ['test text'] });

      expect(response.embeddings).toHaveLength(1);
      expect(response.embeddings[0]).toEqual([0.1, 0.2, 0.3]);
    });
  });

  describe('when an embedding model v2 is provided', () => {
    it('should convert v2 through v3 to v4', () => {
      const v2Model = new MockEmbeddingModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asEmbeddingModelV4(v2Model);

      expect(result.specificationVersion).toBe('v4');
      expect(result.provider).toBe('test-provider');
      expect(result.modelId).toBe('test-model-id');
    });

    it('should make doEmbed method callable', async () => {
      const v2Model = new MockEmbeddingModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doEmbed: async () => ({
          embeddings: [[0.4, 0.5, 0.6]],
        }),
      });

      const result = asEmbeddingModelV4(v2Model);

      const response = await result.doEmbed({ values: ['test text'] });

      expect(response.embeddings).toHaveLength(1);
      expect(response.embeddings[0]).toEqual([0.4, 0.5, 0.6]);
    });
  });
});
