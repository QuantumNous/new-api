import type { ImageModelV4 } from '../../image-model/v4/image-model-v4';
import type { ImageModelV4CallOptions } from '../../image-model/v4/image-model-v4-call-options';

/**
 * Middleware for ImageModelV4.
 * This type defines the structure for middleware that can be used to modify
 * the behavior of ImageModelV4 operations.
 */
export type ImageModelV4Middleware = {
  /**
   * Middleware specification version. Use `v4` for the current version.
   */
  readonly specificationVersion: 'v4';

  /**
   * Override the provider name if desired.
   * @param options.model - The image model instance.
   */
  overrideProvider?: (options: { model: ImageModelV4 }) => string;

  /**
   * Override the model ID if desired.
   * @param options.model - The image model instance.
   */
  overrideModelId?: (options: { model: ImageModelV4 }) => string;

  /**
   * Override the limit of how many images can be generated in a single API call if desired.
   * @param options.model - The image model instance.
   */
  overrideMaxImagesPerCall?: (options: {
    model: ImageModelV4;
  }) => ImageModelV4['maxImagesPerCall'];

  /**
   * Transforms the parameters before they are passed to the image model.
   * @param options - Object containing the parameters.
   * @param options.params - The original parameters for the image model call.
   * @returns A promise that resolves to the transformed parameters.
   */
  transformParams?: (options: {
    params: ImageModelV4CallOptions;
    model: ImageModelV4;
  }) => PromiseLike<ImageModelV4CallOptions>;

  /**
   * Wraps the generate operation of the image model.
   *
   * @param options - Object containing the generate function, parameters, and model.
   * @param options.doGenerate - The original generate function.
   * @param options.params - The parameters for the generate call. If the
   * `transformParams` middleware is used, this will be the transformed parameters.
   * @param options.model - The image model instance.
   * @returns A promise that resolves to the result of the generate operation.
   */
  wrapGenerate?: (options: {
    doGenerate: () => ReturnType<ImageModelV4['doGenerate']>;
    params: ImageModelV4CallOptions;
    model: ImageModelV4;
  }) => Promise<Awaited<ReturnType<ImageModelV4['doGenerate']>>>;
};
