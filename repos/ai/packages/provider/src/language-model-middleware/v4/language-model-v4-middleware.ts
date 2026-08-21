import type { LanguageModelV4 } from '../../language-model/v4/language-model-v4';
import type { LanguageModelV4CallOptions } from '../../language-model/v4/language-model-v4-call-options';
import type { LanguageModelV4GenerateResult } from '../../language-model/v4/language-model-v4-generate-result';
import type { LanguageModelV4StreamResult } from '../../language-model/v4/language-model-v4-stream-result';

/**
 * Experimental middleware for LanguageModelV4.
 * This type defines the structure for middleware that can be used to modify
 * the behavior of LanguageModelV4 operations.
 */
export type LanguageModelV4Middleware = {
  /**
   * Middleware specification version. Use `v4` for the current version.
   */
  readonly specificationVersion: 'v4';

  /**
   * Override the provider name if desired.
   * @param options.model - The language model instance.
   */
  overrideProvider?: (options: { model: LanguageModelV4 }) => string;

  /**
   * Override the model ID if desired.
   * @param options.model - The language model instance.
   */
  overrideModelId?: (options: { model: LanguageModelV4 }) => string;

  /**
   * Override the supported URLs if desired.
   * @param options.model - The language model instance.
   */
  overrideSupportedUrls?: (options: {
    model: LanguageModelV4;
  }) => PromiseLike<Record<string, RegExp[]>> | Record<string, RegExp[]>;

  /**
   * Transforms the parameters before they are passed to the language model.
   * @param options - Object containing the type of operation and the parameters.
   * @param options.type - The type of operation ('generate' or 'stream').
   * @param options.params - The original parameters for the language model call.
   * @returns A promise that resolves to the transformed parameters.
   */
  transformParams?: (options: {
    type: 'generate' | 'stream';
    params: LanguageModelV4CallOptions;
    model: LanguageModelV4;
  }) => PromiseLike<LanguageModelV4CallOptions>;

  /**
   * Wraps the generate operation of the language model.
   * @param options - Object containing the generate function, parameters, and model.
   * @param options.doGenerate - The original generate function.
   * @param options.doStream - The original stream function.
   * @param options.params - The parameters for the generate call. If the
   * `transformParams` middleware is used, this will be the transformed parameters.
   * @param options.model - The language model instance.
   * @returns A promise that resolves to the result of the generate operation.
   */
  wrapGenerate?: (options: {
    doGenerate: () => PromiseLike<LanguageModelV4GenerateResult>;
    doStream: () => PromiseLike<LanguageModelV4StreamResult>;
    params: LanguageModelV4CallOptions;
    model: LanguageModelV4;
  }) => PromiseLike<LanguageModelV4GenerateResult>;

  /**
   * Wraps the stream operation of the language model.
   *
   * @param options - Object containing the stream function, parameters, and model.
   * @param options.doGenerate - The original generate function.
   * @param options.doStream - The original stream function.
   * @param options.params - The parameters for the stream call. If the
   * `transformParams` middleware is used, this will be the transformed parameters.
   * @param options.model - The language model instance.
   * @returns A promise that resolves to the result of the stream operation.
   */
  wrapStream?: (options: {
    doGenerate: () => PromiseLike<LanguageModelV4GenerateResult>;
    doStream: () => PromiseLike<LanguageModelV4StreamResult>;
    params: LanguageModelV4CallOptions;
    model: LanguageModelV4;
  }) => PromiseLike<LanguageModelV4StreamResult>;
};
