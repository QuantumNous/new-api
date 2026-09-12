import {
  NoSuchModelError,
  type EmbeddingModelV4,
  type ImageModelV4,
  type LanguageModelV4,
  type ProviderV4,
  type SpeechModelV4,
  type TranscriptionModelV4,
  type RerankingModelV4,
} from '@ai-sdk/provider';
export class MockProviderV4 implements ProviderV4 {
  readonly specificationVersion = 'v4' as const;

  languageModel: ProviderV4['languageModel'];
  embeddingModel: ProviderV4['embeddingModel'];
  imageModel: ProviderV4['imageModel'];
  transcriptionModel: ProviderV4['transcriptionModel'];
  speechModel: ProviderV4['speechModel'];
  rerankingModel: ProviderV4['rerankingModel'];

  constructor({
    languageModels,
    embeddingModels,
    imageModels,
    transcriptionModels,
    speechModels,
    rerankingModels,
  }: {
    languageModels?: Record<string, LanguageModelV4>;
    embeddingModels?: Record<string, EmbeddingModelV4>;
    imageModels?: Record<string, ImageModelV4>;
    transcriptionModels?: Record<string, TranscriptionModelV4>;
    speechModels?: Record<string, SpeechModelV4>;
    rerankingModels?: Record<string, RerankingModelV4>;
  } = {}) {
    this.languageModel = (modelId: string) => {
      if (!languageModels?.[modelId]) {
        throw new NoSuchModelError({ modelId, modelType: 'languageModel' });
      }
      return languageModels[modelId];
    };
    this.embeddingModel = (modelId: string) => {
      if (!embeddingModels?.[modelId]) {
        throw new NoSuchModelError({
          modelId,
          modelType: 'embeddingModel',
        });
      }
      return embeddingModels[modelId];
    };
    this.imageModel = (modelId: string) => {
      if (!imageModels?.[modelId]) {
        throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
      }
      return imageModels[modelId];
    };
    this.transcriptionModel = (modelId: string) => {
      if (!transcriptionModels?.[modelId]) {
        throw new NoSuchModelError({
          modelId,
          modelType: 'transcriptionModel',
        });
      }
      return transcriptionModels[modelId];
    };
    this.speechModel = (modelId: string): SpeechModelV4 => {
      if (!speechModels?.[modelId]) {
        throw new NoSuchModelError({ modelId, modelType: 'speechModel' });
      }
      return speechModels[modelId];
    };
    this.rerankingModel = (modelId: string) => {
      if (!rerankingModels?.[modelId]) {
        throw new NoSuchModelError({ modelId, modelType: 'rerankingModel' });
      }
      return rerankingModels[modelId];
    };
  }
}
