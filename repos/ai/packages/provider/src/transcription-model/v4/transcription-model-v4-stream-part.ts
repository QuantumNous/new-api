import type { JSONObject } from '../../json-value/json-value';
import type { SharedV4Headers } from '../../shared';
import type { SharedV4ProviderMetadata } from '../../shared/v4/shared-v4-provider-metadata';
import type { SharedV4Warning } from '../../shared/v4/shared-v4-warning';

export type TranscriptionModelV4StreamPart =
  | {
      /**
       * Stream start event with warnings for the call, e.g. unsupported settings.
       */
      type: 'stream-start';
      warnings: Array<SharedV4Warning>;
    }
  | {
      /**
       * Append-only transcript delta.
       */
      type: 'transcript-delta';
      id?: string;
      delta: string;
      providerMetadata?: SharedV4ProviderMetadata;
    }
  | {
      /**
       * Non-final transcript text. The text may be revised by later parts.
       */
      type: 'transcript-partial';
      id?: string;
      text: string;
      startSecond?: number;
      durationInSeconds?: number;
      channelIndex?: number;
      providerMetadata?: SharedV4ProviderMetadata;
    }
  | {
      /**
       * Final transcript text for a provider-defined segment or utterance.
       */
      type: 'transcript-final';
      id?: string;
      text: string;
      startSecond?: number;
      endSecond?: number;
      channelIndex?: number;
      providerMetadata?: SharedV4ProviderMetadata;
    }
  | {
      /**
       * Metadata for the response, emitted once available.
       */
      type: 'response-metadata';
      timestamp?: Date;
      modelId?: string;
      headers?: SharedV4Headers;
      body?: unknown;
    }
  | {
      /**
       * Metadata that is available after the stream is finished.
       */
      type: 'finish';
      text: string;
      segments: Array<{
        text: string;
        startSecond: number;
        endSecond: number;
      }>;
      language?: string;
      durationInSeconds?: number;
      providerMetadata?: Record<string, JSONObject>;
    }
  | {
      /**
       * Raw provider chunks if enabled.
       */
      type: 'raw';
      rawValue: unknown;
    }
  | {
      /**
       * Error parts are streamed, allowing for multiple errors.
       */
      type: 'error';
      error: unknown;
    };
