import { describe, expect, it } from 'vitest';
import { MockRerankingModelV3 } from '../test/mock-reranking-model-v3';
import { MockRerankingModelV4 } from '../test/mock-reranking-model-v4';
import { asRerankingModelV4 } from './as-reranking-model-v4';

describe('asRerankingModelV4', () => {
  describe('when a reranking model v4 is provided', () => {
    it('should return the same v4 model unchanged', () => {
      const originalModel = new MockRerankingModelV4({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asRerankingModelV4(originalModel);

      expect(result).toBe(originalModel);
      expect(result.specificationVersion).toBe('v4');
    });

    it('should preserve all v4 model properties', () => {
      const originalModel = new MockRerankingModelV4({
        provider: 'test-provider-v4',
        modelId: 'test-model-v4',
      });

      const result = asRerankingModelV4(originalModel);

      expect(result.provider).toBe('test-provider-v4');
      expect(result.modelId).toBe('test-model-v4');
    });
  });

  describe('when a reranking model v3 is provided', () => {
    it('should convert v3 to v4 and change specificationVersion', () => {
      const v3Model = new MockRerankingModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asRerankingModelV4(v3Model);

      expect(result.specificationVersion).toBe('v4');
      expect(result).not.toBe(v3Model);
    });

    it('should preserve provider property', () => {
      const v3Model = new MockRerankingModelV3({
        provider: 'test-provider-v3',
        modelId: 'test-model-id',
      });

      const result = asRerankingModelV4(v3Model);

      expect(result.provider).toBe('test-provider-v3');
    });

    it('should preserve modelId property', () => {
      const v3Model = new MockRerankingModelV3({
        provider: 'test-provider',
        modelId: 'test-model-v3',
      });

      const result = asRerankingModelV4(v3Model);

      expect(result.modelId).toBe('test-model-v3');
    });

    it('should make doRerank method callable', async () => {
      const v3Model = new MockRerankingModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doRerank: async () => ({
          ranking: [
            { index: 0, relevanceScore: 0.9 },
            { index: 1, relevanceScore: 0.5 },
          ],
        }),
      });

      const result = asRerankingModelV4(v3Model);

      const response = await result.doRerank({
        documents: { type: 'text', values: ['doc1', 'doc2'] },
        query: 'test query',
      });

      expect(response.ranking).toHaveLength(2);
      expect(response.ranking[0].relevanceScore).toBe(0.9);
    });
  });
});
