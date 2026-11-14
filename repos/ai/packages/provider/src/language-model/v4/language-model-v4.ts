import type { LanguageModelV4CallOptions } from './language-model-v4-call-options';
import type { LanguageModelV4GenerateResult } from './language-model-v4-generate-result';
import type { LanguageModelV4StreamResult } from './language-model-v4-stream-result';

/**
 * Specification for a language model that implements the language model interface version 4.
 */
export type LanguageModelV4 = {
  /**
   * The language model must specify which language model interface version it implements.
   */
  readonly specificationVersion: 'v4';

  /**
   * Provider ID.
   */
  readonly provider: string;

  /**
   * Provider-specific model ID.
   */
  readonly modelId: string;

  /**
   * Supported URL patterns by media type for the provider.
   *
   * The keys are media type patterns or full media types (e.g. `*\/*` for everything, `audio/*`, `video/*`, or `application/pdf`).
   * and the values are arrays of regular expressions that match the URL paths.
   *
   * The matching should be against lower-case URLs.
   *
   * Matched URLs are supported natively by the model and are not downloaded.
   *
   * @returns A map of supported URL patterns by media type (as a promise or a plain object).
   */
  supportedUrls:
    | PromiseLike<Record<string, RegExp[]>>
    | Record<string, RegExp[]>;

  /**
   * Generates a language model output (non-streaming).
   *
   * Naming: "do" prefix to prevent accidental direct usage of the method
   * by the user.
   */
  doGenerate(
    options: LanguageModelV4CallOptions,
  ): PromiseLike<LanguageModelV4GenerateResult>;

  /**
   * Generates a language model output (streaming).
   *
   * Naming: "do" prefix to prevent accidental direct usage of the method
   * by the user.
   *
   * @return A stream of higher-level language model output parts.
   */
  doStream(
    options: LanguageModelV4CallOptions,
  ): PromiseLike<LanguageModelV4StreamResult>;
};
