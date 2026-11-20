import { z } from 'zod/v4';

// https://elevenlabs.io/docs/api-reference/speech-to-text/convert
export const elevenLabsTranscriptionModelOptionsSchema = z.object({
  languageCode: z.string().nullish(),
  tagAudioEvents: z.boolean().nullish().default(true),
  numSpeakers: z.number().int().min(1).max(32).nullish(),
  timestampsGranularity: z
    .enum(['none', 'word', 'character'])
    .nullish()
    .default('word'),
  diarize: z.boolean().nullish().default(false),
  fileFormat: z.enum(['pcm_s16le_16', 'other']).nullish().default('other'),
});

export type ElevenLabsTranscriptionModelOptions = z.infer<
  typeof elevenLabsTranscriptionModelOptionsSchema
>;
