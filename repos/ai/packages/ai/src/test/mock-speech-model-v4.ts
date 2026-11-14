import type { SpeechModelV4 } from '@ai-sdk/provider';
import { notImplemented } from './not-implemented';

export class MockSpeechModelV4 implements SpeechModelV4 {
  readonly specificationVersion = 'v4';
  readonly provider: SpeechModelV4['provider'];
  readonly modelId: SpeechModelV4['modelId'];

  doGenerate: SpeechModelV4['doGenerate'];

  constructor({
    provider = 'mock-provider',
    modelId = 'mock-model-id',
    doGenerate = notImplemented,
  }: {
    provider?: SpeechModelV4['provider'];
    modelId?: SpeechModelV4['modelId'];
    doGenerate?: SpeechModelV4['doGenerate'];
  } = {}) {
    this.provider = provider;
    this.modelId = modelId;
    this.doGenerate = doGenerate;
  }
}
