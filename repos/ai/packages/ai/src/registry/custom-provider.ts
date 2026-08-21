import {
  type EmbeddingModelV4,
  type Experimental_VideoModelV4,
  type FilesV4,
  type ImageModelV4,
  type LanguageModelV4,
  NoSuchModelError,
  type ProviderV2,
  type ProviderV3,
  type ProviderV4,
  type RerankingModelV4,
  type SkillsV4,
  type SpeechModelV4,
  type TranscriptionModelV4,
} from '@ai-sdk/provider';
import { asProviderV4 } from '../model/as-provider-v4';
import {
  resolveEmbeddingModel,
  resolveImageModel,
  resolveLanguageModel,
  resolveRerankingModel,
  resolveSpeechModel,
  resolveTranscriptionModel,
  resolveVideoModel,
} from '../model/resolve-model';
import type { EmbeddingModel } from '../types/embedding-model';
import type { ImageModel } from '../types/image-model';
import type { LanguageModel } from '../types/language-model';
import type { RerankingModel } from '../types/reranking-model';
import type { SpeechModel } from '../types/speech-model';
import type { TranscriptionModel } from '../types/transcription-model';
import type { VideoModel } from '../types/video-model';

/**
 * Creates a custom provider with specified language models, text embedding models, image models, transcription models, speech models, file APIs, skill APIs, and an optional fallback provider.
 *
 * @param {Object} options - The options for creating the custom provider.
 * @param {Record<string, LanguageModel>} [options.languageModels] - A record of language models, where keys are model IDs and values are language model instances.
 * @param {Record<string, EmbeddingModel>} [options.embeddingModels] - A record of text embedding models, where keys are model IDs and values are embedding model instances.
 * @param {Record<string, ImageModel>} [options.imageModels] - A record of image models, where keys are model IDs and values are image model instances.
 * @param {Record<string, TranscriptionModel>} [options.transcriptionModels] - A record of transcription models, where keys are model IDs and values are transcription model instances.
 * @param {Record<string, SpeechModel>} [options.speechModels] - A record of speech models, where keys are model IDs and values are speech model instances.
 * @param {Record<string, RerankingModel>} [options.rerankingModels] - A record of reranking models, where keys are model IDs and values are reranking model instances.
 * @param {Record<string, VideoModel>} [options.videoModels] - A record of video models, where keys are model IDs and values are video model instances.
 * @param {FilesV4} [options.files] - A files interface for uploading files.
 * @param {SkillsV4} [options.skills] - A skills interface for uploading skills.
 * @param {ProviderV2 | ProviderV3 | ProviderV4} [options.fallbackProvider] - An optional fallback provider to use when a requested model is not found in the custom provider.
 * @returns {ProviderV4} A ProviderV4 object with languageModel, embeddingModel, imageModel, transcriptionModel, speechModel, rerankingModel, and videoModel methods.
 *
 * @throws {NoSuchModelError} Throws when a requested model is not found and no fallback provider is available.
 */
export function customProvider<
  LANGUAGE_MODELS extends Record<string, LanguageModel>,
  EMBEDDING_MODELS extends Record<string, EmbeddingModel>,
  IMAGE_MODELS extends Record<string, ImageModel>,
  TRANSCRIPTION_MODELS extends Record<string, TranscriptionModel>,
  SPEECH_MODELS extends Record<string, SpeechModel>,
  RERANKING_MODELS extends Record<string, RerankingModel>,
  VIDEO_MODELS extends Record<string, VideoModel>,
  FILES extends FilesV4 | undefined = undefined,
  SKILLS extends SkillsV4 | undefined = undefined,
  FALLBACK extends ProviderV2 | ProviderV3 | ProviderV4 | undefined = undefined,
>({
  languageModels,
  embeddingModels,
  imageModels,
  transcriptionModels,
  speechModels,
  rerankingModels,
  videoModels,
  files,
  skills,
  fallbackProvider: fallbackProviderArg,
}: {
  languageModels?: LANGUAGE_MODELS;
  embeddingModels?: EMBEDDING_MODELS;
  imageModels?: IMAGE_MODELS;
  transcriptionModels?: TRANSCRIPTION_MODELS;
  speechModels?: SPEECH_MODELS;
  rerankingModels?: RERANKING_MODELS;
  videoModels?: VIDEO_MODELS;
  files?: FILES;
  skills?: SKILLS;
  fallbackProvider?: FALLBACK;
}): ProviderV4 & {
  languageModel(modelId: ExtractModelId<LANGUAGE_MODELS>): LanguageModelV4;
  embeddingModel(modelId: ExtractModelId<EMBEDDING_MODELS>): EmbeddingModelV4;
  imageModel(modelId: ExtractModelId<IMAGE_MODELS>): ImageModelV4;
  transcriptionModel(
    modelId: ExtractModelId<TRANSCRIPTION_MODELS>,
  ): TranscriptionModelV4;
  rerankingModel(modelId: ExtractModelId<RERANKING_MODELS>): RerankingModelV4;
  speechModel(modelId: ExtractModelId<SPEECH_MODELS>): SpeechModelV4;
  videoModel(modelId: ExtractModelId<VIDEO_MODELS>): Experimental_VideoModelV4;
} & (FILES extends FilesV4
    ? { files(): FilesV4 }
    : [FALLBACK] extends [{ files: () => FilesV4 }]
      ? { files(): FilesV4 }
      : { files?(): FilesV4 }) &
  (SKILLS extends SkillsV4
    ? { skills(): SkillsV4 }
    : [FALLBACK] extends [{ skills: () => SkillsV4 }]
      ? { skills(): SkillsV4 }
      : { skills?(): SkillsV4 }) {
  const fallbackProvider =
    fallbackProviderArg == null ? undefined : asProviderV4(fallbackProviderArg);

  const baseProvider: ProviderV4 & {
    languageModel(modelId: ExtractModelId<LANGUAGE_MODELS>): LanguageModelV4;
    embeddingModel(modelId: ExtractModelId<EMBEDDING_MODELS>): EmbeddingModelV4;
    imageModel(modelId: ExtractModelId<IMAGE_MODELS>): ImageModelV4;
    transcriptionModel(
      modelId: ExtractModelId<TRANSCRIPTION_MODELS>,
    ): TranscriptionModelV4;
    rerankingModel(modelId: ExtractModelId<RERANKING_MODELS>): RerankingModelV4;
    speechModel(modelId: ExtractModelId<SPEECH_MODELS>): SpeechModelV4;
    videoModel(
      modelId: ExtractModelId<VIDEO_MODELS>,
    ): Experimental_VideoModelV4;
  } = {
    specificationVersion: 'v4',
    languageModel(modelId: ExtractModelId<LANGUAGE_MODELS>): LanguageModelV4 {
      if (languageModels != null && modelId in languageModels) {
        return resolveLanguageModel(languageModels[modelId]);
      }

      if (fallbackProvider) {
        return fallbackProvider.languageModel(modelId);
      }

      throw new NoSuchModelError({ modelId, modelType: 'languageModel' });
    },

    embeddingModel(
      modelId: ExtractModelId<EMBEDDING_MODELS>,
    ): EmbeddingModelV4 {
      if (embeddingModels != null && modelId in embeddingModels) {
        return resolveEmbeddingModel(embeddingModels[modelId]);
      }

      if (fallbackProvider) {
        return fallbackProvider.embeddingModel(modelId);
      }

      throw new NoSuchModelError({ modelId, modelType: 'embeddingModel' });
    },

    imageModel(modelId: ExtractModelId<IMAGE_MODELS>): ImageModelV4 {
      if (imageModels != null && modelId in imageModels) {
        return resolveImageModel(imageModels[modelId]);
      }

      if (fallbackProvider?.imageModel) {
        return fallbackProvider.imageModel(modelId);
      }

      throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
    },

    transcriptionModel(
      modelId: ExtractModelId<TRANSCRIPTION_MODELS>,
    ): TranscriptionModelV4 {
      if (transcriptionModels != null && modelId in transcriptionModels) {
        const model = resolveTranscriptionModel(transcriptionModels[modelId]);

        if (model != null) {
          return model;
        }
      }

      if (fallbackProvider?.transcriptionModel) {
        return fallbackProvider.transcriptionModel(modelId);
      }

      throw new NoSuchModelError({ modelId, modelType: 'transcriptionModel' });
    },

    speechModel(modelId: ExtractModelId<SPEECH_MODELS>): SpeechModelV4 {
      if (speechModels != null && modelId in speechModels) {
        const model = resolveSpeechModel(speechModels[modelId]);

        if (model != null) {
          return model;
        }
      }

      if (fallbackProvider?.speechModel) {
        return fallbackProvider.speechModel(modelId);
      }

      throw new NoSuchModelError({ modelId, modelType: 'speechModel' });
    },
    rerankingModel(
      modelId: ExtractModelId<RERANKING_MODELS>,
    ): RerankingModelV4 {
      if (rerankingModels != null && modelId in rerankingModels) {
        return resolveRerankingModel(rerankingModels[modelId]);
      }

      if (fallbackProvider?.rerankingModel) {
        return fallbackProvider.rerankingModel(modelId);
      }

      throw new NoSuchModelError({ modelId, modelType: 'rerankingModel' });
    },
    videoModel(
      modelId: ExtractModelId<VIDEO_MODELS>,
    ): Experimental_VideoModelV4 {
      if (videoModels != null && modelId in videoModels) {
        return resolveVideoModel(videoModels[modelId]);
      }

      // TODO AI SDK v7
      // @ts-expect-error - videoModel support is experimental
      const videoModel = fallbackProvider?.videoModel;
      if (videoModel) {
        return videoModel(modelId);
      }

      throw new NoSuchModelError({ modelId, modelType: 'videoModel' });
    },
  };

  const filesAndSkills = {
    ...(files != null || fallbackProvider?.files != null
      ? {
          files(): FilesV4 {
            return files ?? fallbackProvider!.files!();
          },
        }
      : {}),

    ...(skills != null || fallbackProvider?.skills != null
      ? {
          skills(): SkillsV4 {
            return skills ?? fallbackProvider!.skills!();
          },
        }
      : {}),
  } as (FILES extends FilesV4
    ? { files(): FilesV4 }
    : [FALLBACK] extends [{ files: () => FilesV4 }]
      ? { files(): FilesV4 }
      : { files?(): FilesV4 }) &
    (SKILLS extends SkillsV4
      ? { skills(): SkillsV4 }
      : [FALLBACK] extends [{ skills: () => SkillsV4 }]
        ? { skills(): SkillsV4 }
        : { skills?(): SkillsV4 });

  return Object.assign(baseProvider, filesAndSkills);
}

type ExtractModelId<MODELS extends Record<string, unknown>> = Extract<
  keyof MODELS,
  string
>;
