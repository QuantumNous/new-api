import type { EmbeddingModelV4 } from '@ai-sdk/provider';
import { notImplemented } from './not-implemented';

export class MockEmbeddingModelV4 implements EmbeddingModelV4 {
  readonly specificationVersion = 'v4';

  readonly provider: EmbeddingModelV4['provider'];
  readonly modelId: EmbeddingModelV4['modelId'];
  readonly maxEmbeddingsPerCall: EmbeddingModelV4['maxEmbeddingsPerCall'];
  readonly supportsParallelCalls: EmbeddingModelV4['supportsParallelCalls'];

  doEmbed: EmbeddingModelV4['doEmbed'];

  doEmbedCalls: Parameters<EmbeddingModelV4['doEmbed']>[0][] = [];

  constructor({
    provider = 'mock-provider',
    modelId = 'mock-model-id',
    maxEmbeddingsPerCall = 1,
    supportsParallelCalls = false,
    doEmbed = notImplemented,
  }: {
    provider?: EmbeddingModelV4['provider'];
    modelId?: EmbeddingModelV4['modelId'];
    maxEmbeddingsPerCall?: EmbeddingModelV4['maxEmbeddingsPerCall'] | null;
    supportsParallelCalls?: EmbeddingModelV4['supportsParallelCalls'];
    doEmbed?:
      | EmbeddingModelV4['doEmbed']
      | Awaited<ReturnType<EmbeddingModelV4['doEmbed']>>
      | Awaited<ReturnType<EmbeddingModelV4['doEmbed']>>[];
  } = {}) {
    this.provider = provider;
    this.modelId = modelId;
    this.maxEmbeddingsPerCall = maxEmbeddingsPerCall ?? undefined;
    this.supportsParallelCalls = supportsParallelCalls;
    this.doEmbed = async options => {
      this.doEmbedCalls.push(options);

      if (typeof doEmbed === 'function') {
        return doEmbed(options);
      } else if (Array.isArray(doEmbed)) {
        return doEmbed[this.doEmbedCalls.length - 1];
      } else {
        return doEmbed;
      }
    };
  }
}
