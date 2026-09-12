import {
  mistralEmbeddingModelOptions,
  type MistralEmbeddingModelOptions,
} from './mistral-embedding-model-options';
import { describe, expect, it } from 'vitest';

describe('mistralEmbeddingModelOptions', () => {
  it('accepts supported embedding provider options', () => {
    const options: MistralEmbeddingModelOptions = {
      metadata: { source: 'test' },
      outputDimension: 1024,
      outputDtype: 'float',
    };

    expect(mistralEmbeddingModelOptions.safeParse(options).success).toBe(true);
  });

  it('accepts all supported output dtypes', () => {
    for (const outputDtype of [
      'float',
      'int8',
      'uint8',
      'binary',
      'ubinary',
    ] satisfies Array<MistralEmbeddingModelOptions['outputDtype']>) {
      expect(
        mistralEmbeddingModelOptions.safeParse({ outputDtype }).success,
      ).toBe(true);
    }
  });

  it('rejects invalid output dtype values', () => {
    expect(
      mistralEmbeddingModelOptions.safeParse({ outputDtype: 'base64' }).success,
    ).toBe(false);
  });
});
