import type { RerankingModelV3, RerankingModelV4 } from '@ai-sdk/provider';

export function asRerankingModelV4(
  model: RerankingModelV3 | RerankingModelV4,
): RerankingModelV4 {
  if (model.specificationVersion === 'v4') {
    return model;
  }

  return new Proxy(model, {
    get(target, prop: keyof RerankingModelV3) {
      if (prop === 'specificationVersion') return 'v4';
      return target[prop];
    },
  }) as unknown as RerankingModelV4;
}
