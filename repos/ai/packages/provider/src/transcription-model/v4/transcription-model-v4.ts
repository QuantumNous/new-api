import type { TranscriptionModelV4CallOptions } from './transcription-model-v4-call-options';
import type { TranscriptionModelV4Result } from './transcription-model-v4-result';
import type { TranscriptionModelV4StreamOptions } from './transcription-model-v4-stream-options';
import type { TranscriptionModelV4StreamResult } from './transcription-model-v4-stream-result';

/**
 * Transcription model specification version 3.
 */
export type TranscriptionModelV4 = {
  /**
   * The transcription model must specify which transcription model interface
   * version it implements. This will allow us to evolve the transcription
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
   * Generates a transcript.
   */
  doGenerate(
    options: TranscriptionModelV4CallOptions,
  ): PromiseLike<TranscriptionModelV4Result>;

  /**
   * Streams a transcript for live audio.
   *
   * Experimental: the streaming transcription contract may change in patch
   * releases while `experimental_streamTranscribe` is experimental. The
   * stream option/part/result types are exported with `Experimental_`
   * prefixes for this reason.
   */
  doStream?(
    options: TranscriptionModelV4StreamOptions,
  ): PromiseLike<TranscriptionModelV4StreamResult>;
};
