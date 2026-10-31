import type {
  LanguageModelV2,
  LanguageModelV3,
  LanguageModelV4,
} from '@ai-sdk/provider';
import { asLanguageModelV3 } from './as-language-model-v3';

export function asLanguageModelV4(
  model: LanguageModelV2 | LanguageModelV3 | LanguageModelV4,
): LanguageModelV4 {
  if (model.specificationVersion === 'v4') {
    return model;
  }

  // first convert v2 to v3, then proxy v3 as v4:
  const v3Model =
    model.specificationVersion === 'v2' ? asLanguageModelV3(model) : model;

  return new Proxy(v3Model, {
    get(target, prop: keyof LanguageModelV3) {
      if (prop === 'specificationVersion') return 'v4';
      return target[prop];
    },
  }) as unknown as LanguageModelV4;
}
