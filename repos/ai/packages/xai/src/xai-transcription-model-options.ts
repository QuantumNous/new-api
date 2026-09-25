import {
  lazySchema,
  zodSchema,
  type InferSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export const xaiTranscriptionModelOptionsSchema = lazySchema(() =>
  zodSchema(
    z.object({
      /**
       * Audio encoding for raw, headerless input audio.
       */
      audioFormat: z.enum(['pcm', 'mulaw', 'alaw']).nullish(),

      /**
       * Sample rate of the input audio in Hz.
       */
      sampleRate: z
        .union([
          z.literal(8000),
          z.literal(16000),
          z.literal(22050),
          z.literal(24000),
          z.literal(44100),
          z.literal(48000),
        ])
        .nullish(),

      /**
       * Language code used for inverse text normalization.
       */
      language: z.string().nullish(),

      /**
       * Enable inverse text normalization. Requires `language`.
       */
      format: z.boolean().nullish(),

      /**
       * Enable per-channel transcription for multichannel audio.
       */
      multichannel: z.boolean().nullish(),

      /**
       * Number of interleaved audio channels.
       */
      channels: z.number().int().min(2).max(8).nullish(),

      /**
       * Enable speaker diarization.
       */
      diarize: z.boolean().nullish(),

      /**
       * Terms to bias transcription toward.
       */
      keyterm: z.union([z.string(), z.array(z.string())]).nullish(),

      /**
       * Include filler words such as "uh" and "um" in the transcript.
       */
      fillerWords: z.boolean().nullish(),

      /**
       * Options for streaming speech-to-text over WebSocket.
       */
      streaming: z
        .object({
          /**
           * Emit interim transcript results while speech is being processed.
           */
          interimResults: z.boolean().optional(),

          /**
           * Silence duration in milliseconds before an utterance-final event.
           */
          endpointing: z.number().int().min(0).max(5000).optional(),

          /**
           * End-of-turn detection threshold. When set, enables Smart Turn.
           */
          smartTurn: z.number().min(0).max(1).optional(),

          /**
           * Maximum silence duration in milliseconds before forcing speech_final.
           */
          smartTurnTimeout: z.number().int().min(1).max(5000).optional(),
        })
        .optional(),
    }),
  ),
);

export type XaiTranscriptionModelOptions = InferSchema<
  typeof xaiTranscriptionModelOptionsSchema
>;
