import type { RerankingModelV4 } from '@ai-sdk/provider';
import { notImplemented } from './not-implemented';

export class MockRerankingModelV4 implements RerankingModelV4 {
  readonly specificationVersion = 'v4';

  readonly provider: RerankingModelV4['provider'];
  readonly modelId: RerankingModelV4['modelId'];

  doRerank: RerankingModelV4['doRerank'];

  constructor({
    provider = 'mock-provider',
    modelId = 'mock-model-id',
    doRerank = notImplemented,
  }: {
    provider?: RerankingModelV4['provider'];
    modelId?: RerankingModelV4['modelId'];
    doRerank?: RerankingModelV4['doRerank'];
  } = {}) {
    this.provider = provider;
    this.modelId = modelId;
    this.doRerank = doRerank;
  }
}
