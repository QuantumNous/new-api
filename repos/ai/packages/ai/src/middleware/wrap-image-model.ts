import type {
  ImageModelV2,
  ImageModelV3,
  ImageModelV4,
  ImageModelV4CallOptions,
  ImageModelV4Result,
} from '@ai-sdk/provider';
import { asArray } from '@ai-sdk/provider-utils';
import { asImageModelV4 } from '../model/as-image-model-v4';
import type { ImageModelMiddleware } from '../types';

/**
 * Wraps an ImageModelV4 instance with middleware functionality.
 * This function allows you to apply middleware to transform parameters
 * and wrap generate operations of an image model.
 *
 * @param options - Configuration options for wrapping the image model.
 * @param options.model - The original ImageModelV4 instance to be wrapped.
 * @param options.middleware - The middleware to be applied to the image model. When multiple middlewares are provided, the first middleware will transform the input first, and the last middleware will be wrapped directly around the model.
 * @param options.modelId - Optional custom model ID to override the original model's ID.
 * @param options.providerId - Optional custom provider ID to override the original model's provider ID.
 * @returns A new ImageModelV4 instance with middleware applied.
 */
export const wrapImageModel = ({
  model: inputModel,
  middleware: middlewareArg,
  modelId,
  providerId,
}: {
  model: ImageModelV2 | ImageModelV3 | ImageModelV4;
  middleware: ImageModelMiddleware | ImageModelMiddleware[];
  modelId?: string;
  providerId?: string;
}): ImageModelV4 => {
  const model = asImageModelV4(inputModel);
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
    overrideProvider,
    overrideModelId,
    overrideMaxImagesPerCall,
  },
  modelId,
  providerId,
}: {
  model: ImageModelV4;
  middleware: ImageModelMiddleware;
  modelId?: string;
  providerId?: string;
}): ImageModelV4 => {
  async function doTransform({ params }: { params: ImageModelV4CallOptions }) {
    return transformParams ? await transformParams({ params, model }) : params;
  }

  const maxImagesPerCallRaw =
    overrideMaxImagesPerCall?.({ model }) ?? model.maxImagesPerCall;

  // Ensure provider implementations that rely on `this` inside `maxImagesPerCall`
  // keep working after the value is copied onto the wrapper object.
  const maxImagesPerCall =
    maxImagesPerCallRaw instanceof Function
      ? maxImagesPerCallRaw.bind(model)
      : maxImagesPerCallRaw;

  return {
    specificationVersion: 'v4',
    provider: providerId ?? overrideProvider?.({ model }) ?? model.provider,
    modelId: modelId ?? overrideModelId?.({ model }) ?? model.modelId,
    maxImagesPerCall,
    async doGenerate(
      params: ImageModelV4CallOptions,
    ): Promise<ImageModelV4Result> {
      const transformedParams = await doTransform({ params });
      const doGenerate = async () => await model.doGenerate(transformedParams);
      return wrapGenerate
        ? await wrapGenerate({
            doGenerate,
            params: transformedParams,
            model,
          })
        : await doGenerate();
    },
  };
};
