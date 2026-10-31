import { describe, expect, it } from 'vitest';
import { MockEmbeddingModelV3 } from './mock-embedding-model-v3';
import { MockEmbeddingModelV4 } from './mock-embedding-model-v4';

function embeddingResult(value: number) {
  return {
    embeddings: [[value]],
    warnings: [],
  };
}

describe('MockEmbeddingModelV3', () => {
  it('returns array-backed embed results from the first entry', async () => {
    const model = new MockEmbeddingModelV3({
      doEmbed: [embeddingResult(1), embeddingResult(2)],
    });

    await expect(model.doEmbed({ values: ['first'] })).resolves.toMatchObject({
      embeddings: [[1]],
    });
    await expect(model.doEmbed({ values: ['second'] })).resolves.toMatchObject({
      embeddings: [[2]],
    });
  });
});

describe('MockEmbeddingModelV4', () => {
  it('returns array-backed embed results from the first entry', async () => {
    const model = new MockEmbeddingModelV4({
      doEmbed: [embeddingResult(1), embeddingResult(2)],
    });

    await expect(model.doEmbed({ values: ['first'] })).resolves.toMatchObject({
      embeddings: [[1]],
    });
    await expect(model.doEmbed({ values: ['second'] })).resolves.toMatchObject({
      embeddings: [[2]],
    });
  });
});
