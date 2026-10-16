import {
  lazySchema,
  zodSchema,
  type InferSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export const xaiSpeechModelOptionsSchema = lazySchema(() =>
  zodSchema(
    z.object({
      /**
       * Sample rate of the generated audio in Hz.
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
       * MP3 bit rate in bits per second. Only applies when outputFormat is mp3.
       */
      bitRate: z
        .union([
          z.literal(32000),
          z.literal(64000),
          z.literal(96000),
          z.literal(128000),
          z.literal(192000),
        ])
        .nullish(),

      /**
       * Reduce time to first audio chunk, trading some quality for latency.
       */
      optimizeStreamingLatency: z
        .union([z.literal(0), z.literal(1), z.literal(2)])
        .nullish(),

      /**
       * Normalize written-form text into spoken-form text before synthesis.
       */
      textNormalization: z.boolean().nullish(),
    }),
  ),
);

export type XaiSpeechModelOptions = InferSchema<
  typeof xaiSpeechModelOptionsSchema
>;
