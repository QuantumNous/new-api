import { z } from 'zod/v4';

// https://fal.ai/models/fal-ai/whisper/api?platform=http
export const falTranscriptionModelOptionsSchema = z.object({
  /**
   * Language of the audio file. If set to null, the language will be automatically detected. Defaults to null.
   *
   * If translate is selected as the task, the audio will be translated to English, regardless of the language selected.
   */
  language: z
    .union([z.enum(['en']), z.string()])
    .nullish()
    .default('en'),

  /**
   * Whether to diarize the audio file. Defaults to true.
   */
  diarize: z.boolean().nullish().default(true),

  /**
   * Level of the chunks to return. Either segment or word. Default value: "segment"
   */
  chunkLevel: z.enum(['segment', 'word']).nullish().default('segment'),

  /**
   * Version of the model to use. All of the models are the Whisper large variant. Default value: "3"
   */
  version: z.enum(['3']).nullish().default('3'),

  /**
   * Default value: 64
   */
  batchSize: z.number().nullish().default(64),

  /**
   * Number of speakers in the audio file. Defaults to null. If not provided, the number of speakers will be automatically detected.
   */
  numSpeakers: z.number().nullable().nullish(),
});

export type FalTranscriptionModelOptions = z.infer<
  typeof falTranscriptionModelOptionsSchema
>;
