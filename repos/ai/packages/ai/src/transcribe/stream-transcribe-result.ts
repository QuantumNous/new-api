import type { JSONObject, SharedV4ProviderMetadata } from '@ai-sdk/provider';
import type { AsyncIterableStream } from '../util/async-iterable-stream';
import type { TranscriptionModelResponseMetadata } from '../types/transcription-model-response-metadata';
import type { Warning } from '../types/warning';

export type TranscriptionStreamPart =
  | {
      type: 'transcript-delta';
      id?: string;
      delta: string;
      providerMetadata?: SharedV4ProviderMetadata;
    }
  | {
      type: 'transcript-partial';
      id?: string;
      text: string;
      startSecond?: number;
      durationInSeconds?: number;
      channelIndex?: number;
      providerMetadata?: SharedV4ProviderMetadata;
    }
  | {
      type: 'transcript-final';
      id?: string;
      text: string;
      startSecond?: number;
      endSecond?: number;
      channelIndex?: number;
      providerMetadata?: SharedV4ProviderMetadata;
    }
  | {
      type: 'raw';
      rawValue: unknown;
    }
  | {
      type: 'error';
      error: unknown;
    };

export interface StreamTranscriptionResult {
  /**
   * The final transcribed text.
   */
  readonly text: PromiseLike<string>;

  /**
   * Final transcript segments with timing information, if available.
   */
  readonly segments: PromiseLike<
    Array<{
      text: string;
      startSecond: number;
      endSecond: number;
    }>
  >;

  /**
   * The language of the transcript, if available.
   */
  readonly language: PromiseLike<string | undefined>;

  /**
   * The duration of the transcript in seconds, if available.
   */
  readonly durationInSeconds: PromiseLike<number | undefined>;

  /**
   * Warnings for the call, e.g. unsupported settings.
   */
  readonly warnings: PromiseLike<Array<Warning>>;

  /**
   * Response metadata.
   */
  readonly responses: PromiseLike<Array<TranscriptionModelResponseMetadata>>;

  /**
   * Additional provider-specific metadata.
   */
  readonly providerMetadata: PromiseLike<Record<string, JSONObject>>;

  /**
   * Full stream of transcription parts.
   */
  readonly fullStream: AsyncIterableStream<TranscriptionStreamPart>;
}
