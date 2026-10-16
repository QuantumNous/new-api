import { NoSuchModelError } from '@ai-sdk/provider';
import { describe, it, expect } from 'vitest';
import { createVoyage } from './voyage-provider';

const provider = createVoyage({ apiKey: 'test-api-key' });

describe('VoyageProvider', () => {
  it('should create embedding model with correct provider and modelId', () => {
    const model = provider.embeddingModel('voyage-3.5');

    expect(model.modelId).toBe('voyage-3.5');
    expect(model.provider).toBe('voyage.embedding');
  });

  it('should create reranking model with correct provider and modelId', () => {
    const model = provider.rerankingModel('rerank-2.5');

    expect(model.modelId).toBe('rerank-2.5');
    expect(model.provider).toBe('voyage.reranking');
  });

  it('should throw NoSuchModelError for languageModel', () => {
    expect(() => provider.languageModel('some-model')).toThrow(
      NoSuchModelError,
    );
  });

  it('should throw NoSuchModelError for imageModel', () => {
    expect(() => provider.imageModel('some-model')).toThrow(NoSuchModelError);
  });
});
