import type {
  EmbeddingModelV2,
  EmbeddingModelV3,
  EmbeddingModelV4,
} from '@ai-sdk/provider';
import { asEmbeddingModelV3 } from './as-embedding-model-v3';

export function asEmbeddingModelV4(
  model: EmbeddingModelV2<string> | EmbeddingModelV3 | EmbeddingModelV4,
): EmbeddingModelV4 {
  if (model.specificationVersion === 'v4') {
    return model;
  }

  // first convert v2 to v3, then proxy v3 as v4:
  const v3Model =
    model.specificationVersion === 'v2' ? asEmbeddingModelV3(model) : model;

  return new Proxy(v3Model, {
    get(target, prop: keyof EmbeddingModelV3) {
      if (prop === 'specificationVersion') return 'v4';
      return target[prop];
    },
  }) as unknown as EmbeddingModelV4;
}
