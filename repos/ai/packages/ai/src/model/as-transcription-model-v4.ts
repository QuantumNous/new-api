import type {
  TranscriptionModelV2,
  TranscriptionModelV3,
  TranscriptionModelV4,
} from '@ai-sdk/provider';
import { asTranscriptionModelV3 } from './as-transcription-model-v3';

export function asTranscriptionModelV4(
  model: TranscriptionModelV2 | TranscriptionModelV3 | TranscriptionModelV4,
): TranscriptionModelV4 {
  if (model.specificationVersion === 'v4') {
    return model;
  }

  // first convert v2 to v3, then proxy v3 as v4:
  const v3Model =
    model.specificationVersion === 'v2' ? asTranscriptionModelV3(model) : model;

  return new Proxy(v3Model, {
    get(target, prop: keyof TranscriptionModelV3) {
      if (prop === 'specificationVersion') return 'v4';
      return target[prop];
    },
  }) as unknown as TranscriptionModelV4;
}
