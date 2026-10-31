import { gateway } from '@ai-sdk/gateway';
import type {
  EmbeddingModelV4,
  Experimental_VideoModelV4,
  ImageModelV4,
  LanguageModelV4,
  ProviderV4,
  RerankingModelV4,
  SpeechModelV4,
  TranscriptionModelV4,
} from '@ai-sdk/provider';
import { UnsupportedModelVersionError } from '../error';
import type { EmbeddingModel } from '../types/embedding-model';
import type { LanguageModel } from '../types/language-model';
import type { SpeechModel } from '../types/speech-model';
import type { TranscriptionModel } from '../types/transcription-model';
import { asEmbeddingModelV4 } from './as-embedding-model-v4';
import { asImageModelV4 } from './as-image-model-v4';
import { asLanguageModelV4 } from './as-language-model-v4';
import { asRerankingModelV4 } from './as-reranking-model-v4';
import { asSpeechModelV4 } from './as-speech-model-v4';
import { asTranscriptionModelV4 } from './as-transcription-model-v4';
import { asVideoModelV4 } from './as-video-model-v4';
import { asProviderV4 } from './as-provider-v4';
import type { ImageModel } from '../types/image-model';
import type { RerankingModel } from '../types/reranking-model';
import type { VideoModel } from '../types/video-model';

export function resolveLanguageModel(model: LanguageModel): LanguageModelV4 {
  if (typeof model === 'string') {
    return getGlobalProvider().languageModel(model);
  }

  if (!['v4', 'v3', 'v2'].includes(model.specificationVersion)) {
    const unsupportedModel: any = model;
    throw new UnsupportedModelVersionError({
      version: unsupportedModel.specificationVersion,
      provider: unsupportedModel.provider,
      modelId: unsupportedModel.modelId,
    });
  }

  return asLanguageModelV4(model);
}

export function resolveEmbeddingModel(model: EmbeddingModel): EmbeddingModelV4 {
  if (typeof model === 'string') {
    return getGlobalProvider().embeddingModel(model);
  }

  if (!['v4', 'v3', 'v2'].includes(model.specificationVersion)) {
    const unsupportedModel: any = model;
    throw new UnsupportedModelVersionError({
      version: unsupportedModel.specificationVersion,
      provider: unsupportedModel.provider,
      modelId: unsupportedModel.modelId,
    });
  }

  return asEmbeddingModelV4(model);
}

export function resolveTranscriptionModel(
  model: TranscriptionModel,
): TranscriptionModelV4 | undefined {
  if (typeof model === 'string') {
    return getGlobalProvider().transcriptionModel?.(model);
  }

  if (!['v4', 'v3', 'v2'].includes(model.specificationVersion)) {
    const unsupportedModel: any = model;
    throw new UnsupportedModelVersionError({
      version: unsupportedModel.specificationVersion,
      provider: unsupportedModel.provider,
      modelId: unsupportedModel.modelId,
    });
  }

  return asTranscriptionModelV4(model);
}

export function resolveSpeechModel(
  model: SpeechModel,
): SpeechModelV4 | undefined {
  if (typeof model === 'string') {
    return getGlobalProvider().speechModel?.(model);
  }

  if (!['v4', 'v3', 'v2'].includes(model.specificationVersion)) {
    const unsupportedModel: any = model;
    throw new UnsupportedModelVersionError({
      version: unsupportedModel.specificationVersion,
      provider: unsupportedModel.provider,
      modelId: unsupportedModel.modelId,
    });
  }

  return asSpeechModelV4(model);
}

export function resolveImageModel(model: ImageModel): ImageModelV4 {
  if (typeof model === 'string') {
    return getGlobalProvider().imageModel(model);
  }

  if (!['v4', 'v3', 'v2'].includes(model.specificationVersion)) {
    const unsupportedModel: any = model;
    throw new UnsupportedModelVersionError({
      version: unsupportedModel.specificationVersion,
      provider: unsupportedModel.provider,
      modelId: unsupportedModel.modelId,
    });
  }

  return asImageModelV4(model);
}

export function resolveVideoModel(
  model: VideoModel,
): Experimental_VideoModelV4 {
  if (typeof model === 'string') {
    // Use raw global provider because videoModel is experimental
    // and not part of the ProviderV4 interface
    const provider = globalThis.AI_SDK_DEFAULT_PROVIDER ?? gateway;
    // TODO AI SDK v7
    // @ts-expect-error - videoModel support is experimental
    const videoModel = provider.videoModel;

    if (!videoModel) {
      throw new Error(
        'The default provider does not support video models. ' +
          'Please use a Experimental_VideoModelV4 object from a provider (e.g., vertex.video("model-id")).',
      );
    }

    return videoModel(model);
  }

  if (!['v4', 'v3'].includes(model.specificationVersion)) {
    const unsupportedModel: any = model;
    throw new UnsupportedModelVersionError({
      version: unsupportedModel.specificationVersion,
      provider: unsupportedModel.provider,
      modelId: unsupportedModel.modelId,
    });
  }

  return asVideoModelV4(model);
}

export function resolveRerankingModel(model: RerankingModel): RerankingModelV4 {
  if (typeof model === 'string') {
    const provider = getGlobalProvider();
    const rerankingModel = provider.rerankingModel;

    if (!rerankingModel) {
      throw new Error(
        'The default provider does not support reranking models. ' +
          'Please use a RerankingModel object from a provider (e.g., gateway.rerankingModel("model-id")).',
      );
    }

    return rerankingModel(model);
  }

  if (
    model.specificationVersion !== 'v4' &&
    model.specificationVersion !== 'v3'
  ) {
    const unsupportedModel: any = model;
    throw new UnsupportedModelVersionError({
      version: unsupportedModel.specificationVersion,
      provider: unsupportedModel.provider,
      modelId: unsupportedModel.modelId,
    });
  }

  return asRerankingModelV4(model);
}

function getGlobalProvider(): ProviderV4 {
  const provider = globalThis.AI_SDK_DEFAULT_PROVIDER ?? gateway;
  return asProviderV4(provider);
}
