import type { ProviderV2, ProviderV3, ProviderV4 } from '@ai-sdk/provider';
import { asProviderV3 } from './as-provider-v3';
import { asEmbeddingModelV4 } from './as-embedding-model-v4';
import { asImageModelV4 } from './as-image-model-v4';
import { asLanguageModelV4 } from './as-language-model-v4';
import { asRerankingModelV4 } from './as-reranking-model-v4';
import { asTranscriptionModelV4 } from './as-transcription-model-v4';
import { asSpeechModelV4 } from './as-speech-model-v4';

export function asProviderV4(
  provider: ProviderV2 | ProviderV3 | ProviderV4,
): ProviderV4 {
  if (
    'specificationVersion' in provider &&
    provider.specificationVersion === 'v4'
  ) {
    return provider;
  }

  // first ensure we have at least a v3 provider:
  const v3Provider: ProviderV3 =
    !('specificationVersion' in provider) ||
    provider.specificationVersion !== 'v3'
      ? asProviderV3(provider as ProviderV2)
      : provider;

  return {
    specificationVersion: 'v4',
    languageModel: (modelId: string) =>
      asLanguageModelV4(v3Provider.languageModel(modelId)),
    embeddingModel: (modelId: string) =>
      asEmbeddingModelV4(v3Provider.embeddingModel(modelId)),
    imageModel: (modelId: string) =>
      asImageModelV4(v3Provider.imageModel(modelId)),
    transcriptionModel: v3Provider.transcriptionModel
      ? (modelId: string) =>
          asTranscriptionModelV4(v3Provider.transcriptionModel!(modelId))
      : undefined,
    speechModel: v3Provider.speechModel
      ? (modelId: string) => asSpeechModelV4(v3Provider.speechModel!(modelId))
      : undefined,
    rerankingModel: v3Provider.rerankingModel
      ? (modelId: string) =>
          asRerankingModelV4(v3Provider.rerankingModel!(modelId))
      : undefined,
  };
}
