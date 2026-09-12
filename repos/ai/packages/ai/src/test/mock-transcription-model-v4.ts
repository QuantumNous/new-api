import type { TranscriptionModelV4 } from '@ai-sdk/provider';
import { notImplemented } from './not-implemented';

export class MockTranscriptionModelV4 implements TranscriptionModelV4 {
  readonly specificationVersion = 'v4';
  readonly provider: TranscriptionModelV4['provider'];
  readonly modelId: TranscriptionModelV4['modelId'];

  doGenerate: TranscriptionModelV4['doGenerate'];
  doStream: TranscriptionModelV4['doStream'];

  constructor({
    provider = 'mock-provider',
    modelId = 'mock-model-id',
    doGenerate = notImplemented,
    doStream,
  }: {
    provider?: TranscriptionModelV4['provider'];
    modelId?: TranscriptionModelV4['modelId'];
    doGenerate?: TranscriptionModelV4['doGenerate'];
    doStream?: TranscriptionModelV4['doStream'];
  } = {}) {
    this.provider = provider;
    this.modelId = modelId;
    this.doGenerate = doGenerate;
    this.doStream = doStream;
  }
}
