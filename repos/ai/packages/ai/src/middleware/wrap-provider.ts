import type { ProviderV2, ProviderV3, ProviderV4 } from '@ai-sdk/provider';
import type { ImageModelMiddleware } from '../types/image-model-middleware';
import type { LanguageModelMiddleware } from '../types/language-model-middleware';
import { wrapImageModel } from './wrap-image-model';
import { wrapLanguageModel } from './wrap-language-model';
import { asProviderV4 } from '../model/as-provider-v4';

/**
 * Wraps a ProviderV4 instance with middleware functionality.
 * This function allows you to apply middleware to all language models
 * from the provider, enabling you to transform parameters, wrap generate
 * operations, and wrap stream operations for every language model.
 *
 * @param options - Configuration options for wrapping the provider.
 * @param options.provider - The original ProviderV4 instance to be wrapped.
 * @param options.languageModelMiddleware - The middleware to be applied to all language models from the provider. When multiple middlewares are provided, the first middleware will transform the input first, and the last middleware will be wrapped directly around the model.
 * @param options.imageModelMiddleware - Optional middleware to be applied to all image models from the provider. When multiple middlewares are provided, the first middleware will transform the input first, and the last middleware will be wrapped directly around the model.
 * @returns A new ProviderV4 instance with middleware applied to all language models.
 */
export function wrapProvider({
  provider,
  languageModelMiddleware,
  imageModelMiddleware,
}: {
  provider: ProviderV4 | ProviderV3 | ProviderV2;
  languageModelMiddleware: LanguageModelMiddleware | LanguageModelMiddleware[];
  imageModelMiddleware?: ImageModelMiddleware | ImageModelMiddleware[];
}): ProviderV4 {
  const providerV4 = asProviderV4(provider);
  return {
    specificationVersion: 'v4',
    languageModel: (modelId: string) =>
      wrapLanguageModel({
        model: providerV4.languageModel(modelId),
        middleware: languageModelMiddleware,
      }),
    embeddingModel: providerV4.embeddingModel,
    imageModel: (modelId: string) => {
      let model = providerV4.imageModel(modelId);

      if (imageModelMiddleware != null) {
        model = wrapImageModel({ model, middleware: imageModelMiddleware });
      }

      return model;
    },
    transcriptionModel: providerV4.transcriptionModel,
    speechModel: providerV4.speechModel,
    rerankingModel: providerV4.rerankingModel,
  };
}
