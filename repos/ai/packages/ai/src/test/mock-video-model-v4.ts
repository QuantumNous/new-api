import type { Experimental_VideoModelV4 } from '@ai-sdk/provider';
import { notImplemented } from './not-implemented';

export class MockVideoModelV4 implements Experimental_VideoModelV4 {
  readonly specificationVersion = 'v4';
  readonly provider: Experimental_VideoModelV4['provider'];
  readonly modelId: Experimental_VideoModelV4['modelId'];
  readonly maxVideosPerCall: Experimental_VideoModelV4['maxVideosPerCall'];

  doGenerate: Experimental_VideoModelV4['doGenerate'];

  constructor({
    provider = 'mock-provider',
    modelId = 'mock-model-id',
    maxVideosPerCall = 1,
    doGenerate = notImplemented,
  }: {
    provider?: Experimental_VideoModelV4['provider'];
    modelId?: Experimental_VideoModelV4['modelId'];
    maxVideosPerCall?: Experimental_VideoModelV4['maxVideosPerCall'];
    doGenerate?: Experimental_VideoModelV4['doGenerate'];
  } = {}) {
    this.provider = provider;
    this.modelId = modelId;
    this.maxVideosPerCall = maxVideosPerCall;
    this.doGenerate = doGenerate;
  }
}
