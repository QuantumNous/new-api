import type { SpeechModelV4CallOptions } from './speech-model-v4-call-options';
import type { SpeechModelV4Result } from './speech-model-v4-result';

/**
 * Speech model specification version 3.
 */
export type SpeechModelV4 = {
  /**
   * The speech model must specify which speech model interface
   * version it implements. This will allow us to evolve the speech
   * model interface and retain backwards compatibility. The different
   * implementation versions can be handled as a discriminated union
   * on our side.
   */
  readonly specificationVersion: 'v4';

  /**
   * Name of the provider for logging purposes.
   */
  readonly provider: string;

  /**
   * Provider-specific model ID for logging purposes.
   */
  readonly modelId: string;

  /**
   * Generates speech audio from text.
   */
  doGenerate(
    options: SpeechModelV4CallOptions,
  ): PromiseLike<SpeechModelV4Result>;
};
