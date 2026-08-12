import type {
  LanguageModelV2,
  LanguageModelV3,
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamResult,
} from '@ai-sdk/provider';
import { asArray } from '@ai-sdk/provider-utils';
import { asLanguageModelV4 } from '../model/as-language-model-v4';
import type { LanguageModelMiddleware } from '../types';

/**
 * Wraps a LanguageModelV4 instance with middleware functionality.
 * This function allows you to apply middleware to transform parameters,
 * wrap generate operations, and wrap stream operations of a language model.
 *
 * @param options - Configuration options for wrapping the language model.
 * @param options.model - The original LanguageModelV4 instance to be wrapped.
 * @param options.middleware - The middleware to be applied to the language model. When multiple middlewares are provided, the first middleware will transform the input first, and the last middleware will be wrapped directly around the model.
 * @param options.modelId - Optional custom model ID to override the original model's ID.
 * @param options.providerId - Optional custom provider ID to override the original model's provider ID.
 * @returns A new LanguageModelV4 instance with middleware applied.
 */
export const wrapLanguageModel = ({
  model: inputModel,
  middleware: middlewareArg,
  modelId,
  providerId,
}: {
  model: LanguageModelV2 | LanguageModelV3 | LanguageModelV4;
  middleware: LanguageModelMiddleware | LanguageModelMiddleware[];
  modelId?: string;
  providerId?: string;
}): LanguageModelV4 => {
  const model = asLanguageModelV4(inputModel);
  return [...asArray(middlewareArg)]
    .reverse()
    .reduce((wrappedModel, middleware) => {
      return doWrap({ model: wrappedModel, middleware, modelId, providerId });
    }, model);
};

const doWrap = ({
  model,
  middleware: {
    transformParams,
    wrapGenerate,
    wrapStream,
    overrideProvider,
    overrideModelId,
    overrideSupportedUrls,
  },
  modelId,
  providerId,
}: {
  model: LanguageModelV4;
  middleware: LanguageModelMiddleware;
  modelId?: string;
  providerId?: string;
}): LanguageModelV4 => {
  async function doTransform({
    params,
    type,
  }: {
    params: LanguageModelV4CallOptions;
    type: 'generate' | 'stream';
  }) {
    return transformParams
      ? await transformParams({ params, type, model })
      : params;
  }

  return {
    specificationVersion: 'v4',

    provider: providerId ?? overrideProvider?.({ model }) ?? model.provider,
    modelId: modelId ?? overrideModelId?.({ model }) ?? model.modelId,
    supportedUrls: overrideSupportedUrls?.({ model }) ?? model.supportedUrls,

    async doGenerate(
      params: LanguageModelV4CallOptions,
    ): Promise<LanguageModelV4GenerateResult> {
      const transformedParams = await doTransform({ params, type: 'generate' });
      const doGenerate = async () => await model.doGenerate(transformedParams);
      const doStream = async () => await model.doStream(transformedParams);
      return wrapGenerate
        ? await wrapGenerate({
            doGenerate,
            doStream,
            params: transformedParams,
            model,
          })
        : await doGenerate();
    },

    async doStream(
      params: LanguageModelV4CallOptions,
    ): Promise<LanguageModelV4StreamResult> {
      const transformedParams = await doTransform({ params, type: 'stream' });
      const doGenerate = async () => await model.doGenerate(transformedParams);
      const doStream = async () => await model.doStream(transformedParams);
      return wrapStream
        ? await wrapStream({
            doGenerate,
            doStream,
            params: transformedParams,
            model,
          })
        : await doStream();
    },
  };
};
