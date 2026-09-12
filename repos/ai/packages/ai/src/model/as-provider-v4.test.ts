import { describe, expect, it } from 'vitest';
import { MockProviderV3 } from '../test/mock-provider-v3';
import { MockProviderV4 } from '../test/mock-provider-v4';
import { MockLanguageModelV3 } from '../test/mock-language-model-v3';
import { MockLanguageModelV4 } from '../test/mock-language-model-v4';
import { MockEmbeddingModelV3 } from '../test/mock-embedding-model-v3';
import { MockEmbeddingModelV4 } from '../test/mock-embedding-model-v4';
import { MockImageModelV3 } from '../test/mock-image-model-v3';
import { MockImageModelV4 } from '../test/mock-image-model-v4';
import { MockRerankingModelV3 } from '../test/mock-reranking-model-v3';
import { asProviderV4 } from './as-provider-v4';

describe('asProviderV4', () => {
  describe('when a provider v4 is provided', () => {
    it('should return the same v4 provider unchanged', () => {
      const originalProvider = new MockProviderV4({
        languageModels: {
          'test-model': new MockLanguageModelV4({
            provider: 'test-provider',
            modelId: 'test-model',
          }),
        },
      });

      const result = asProviderV4(originalProvider);

      expect(result).toBe(originalProvider);
    });
  });

  describe('when a provider v3 is provided', () => {
    it('should convert to v4 with specificationVersion v4', () => {
      const v3Provider = new MockProviderV3({
        languageModels: {
          'test-model': new MockLanguageModelV3({
            provider: 'test-provider',
            modelId: 'test-model',
          }),
        },
        embeddingModels: {
          'test-embedding': new MockEmbeddingModelV3({
            provider: 'test-provider',
            modelId: 'test-embedding',
          }),
        },
        imageModels: {
          'test-image': new MockImageModelV3({
            provider: 'test-provider',
            modelId: 'test-image',
          }),
        },
      });

      const result = asProviderV4(v3Provider);

      expect(result.specificationVersion).toBe('v4');
    });

    it('should wrap language models to return v4', () => {
      const v3Provider = new MockProviderV3({
        languageModels: {
          'test-model': new MockLanguageModelV3({
            provider: 'test-provider',
            modelId: 'test-model',
          }),
        },
      });

      const result = asProviderV4(v3Provider);
      const model = result.languageModel('test-model');

      expect(model.specificationVersion).toBe('v4');
      expect(model.provider).toBe('test-provider');
      expect(model.modelId).toBe('test-model');
    });

    it('should wrap embedding models to return v4', () => {
      const v3Provider = new MockProviderV3({
        embeddingModels: {
          'test-embedding': new MockEmbeddingModelV3({
            provider: 'test-provider',
            modelId: 'test-embedding',
          }),
        },
      });

      const result = asProviderV4(v3Provider);
      const model = result.embeddingModel('test-embedding');

      expect(model.specificationVersion).toBe('v4');
      expect(model.provider).toBe('test-provider');
    });

    it('should wrap image models to return v4', () => {
      const v3Provider = new MockProviderV3({
        imageModels: {
          'test-image': new MockImageModelV3({
            provider: 'test-provider',
            modelId: 'test-image',
          }),
        },
      });

      const result = asProviderV4(v3Provider);
      const model = result.imageModel('test-image');

      expect(model.specificationVersion).toBe('v4');
      expect(model.provider).toBe('test-provider');
    });

    it('should wrap reranking models to return v4', () => {
      const v3Provider = new MockProviderV3({
        rerankingModels: {
          'test-reranking': new MockRerankingModelV3({
            provider: 'test-provider',
            modelId: 'test-reranking',
          }),
        },
      });

      const result = asProviderV4(v3Provider);
      const model = result.rerankingModel!('test-reranking');

      expect(model.specificationVersion).toBe('v4');
      expect(model.provider).toBe('test-provider');
    });

    it('should preserve optional model factories as undefined when not set', () => {
      const v3Provider = new MockProviderV3({});
      // Override optional methods to be undefined
      v3Provider.transcriptionModel = undefined;
      v3Provider.speechModel = undefined;
      v3Provider.rerankingModel = undefined;

      const result = asProviderV4(v3Provider);

      expect(result.transcriptionModel).toBeUndefined();
      expect(result.speechModel).toBeUndefined();
      expect(result.rerankingModel).toBeUndefined();
    });
  });
});
