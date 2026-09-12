import type { ImageModelV4 } from '@ai-sdk/provider';
import { notImplemented } from './not-implemented';

export class MockImageModelV4 implements ImageModelV4 {
  readonly specificationVersion = 'v4';
  readonly provider: ImageModelV4['provider'];
  readonly modelId: ImageModelV4['modelId'];
  readonly maxImagesPerCall: ImageModelV4['maxImagesPerCall'];

  doGenerate: ImageModelV4['doGenerate'];

  constructor({
    provider = 'mock-provider',
    modelId = 'mock-model-id',
    maxImagesPerCall = 1,
    doGenerate = notImplemented,
  }: {
    provider?: ImageModelV4['provider'];
    modelId?: ImageModelV4['modelId'];
    maxImagesPerCall?: ImageModelV4['maxImagesPerCall'];
    doGenerate?: ImageModelV4['doGenerate'];
  } = {}) {
    this.provider = provider;
    this.modelId = modelId;
    this.maxImagesPerCall = maxImagesPerCall;
    this.doGenerate = doGenerate;
  }
}
