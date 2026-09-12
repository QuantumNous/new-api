import type {
  Experimental_VideoModelV3,
  Experimental_VideoModelV4,
} from '@ai-sdk/provider';

export function asVideoModelV4(
  model: Experimental_VideoModelV3 | Experimental_VideoModelV4,
): Experimental_VideoModelV4 {
  if (model.specificationVersion === 'v4') {
    return model;
  }

  return new Proxy(model, {
    get(target, prop: keyof Experimental_VideoModelV3) {
      if (prop === 'specificationVersion') return 'v4';
      return target[prop];
    },
  }) as unknown as Experimental_VideoModelV4;
}
