import { z } from 'zod/v4';

// https://docs.cartesia.ai/api-reference/stt/transcribe
export const cartesiaTranscriptionModelOptionsSchema = z.object({
  /** The language of the audio (ISO 639-1 code). Defaults to English. */
  language: z.string().nullish(),
  /** The timestamp granularities to populate. Currently only `word` is supported. */
  timestampGranularities: z.array(z.enum(['word'])).nullish(),
  /** Options for realtime Ink 2 transcription over WebSocket. */
  streaming: z
    .object({
      /**
       * Use Cartesia's native turn detection endpoint. Defaults to true.
       * Disable this to finalize the transcript only when the audio stream ends.
       */
      turnDetection: z.boolean().optional(),
    })
    .optional(),
});

export type CartesiaTranscriptionModelOptions = z.infer<
  typeof cartesiaTranscriptionModelOptionsSchema
>;
