import { z } from 'zod/v4';

// https://docs.lmnt.com/api-reference/speech/synthesize-speech-bytes
export const lmntSpeechModelOptionsSchema = z.object({
  /**
   * The model to use for speech synthesis e.g. 'aurora' or 'blizzard'.
   * @default 'aurora'
   */
  model: z
    .union([z.enum(['aurora', 'blizzard']), z.string()])
    .nullish()
    .default('aurora'),

  /**
   * The audio format of the output.
   * @default 'mp3'
   */
  format: z
    .enum(['aac', 'mp3', 'mulaw', 'raw', 'wav'])
    .nullish()
    .default('mp3'),

  /**
   * The sample rate of the output audio in Hz.
   * @default 24000
   */
  sampleRate: z
    .union([z.literal(8000), z.literal(16000), z.literal(24000)])
    .nullish()
    .default(24000),

  /**
   * The speed of the speech. Range: 0.25 to 2.
   * @default 1
   */
  speed: z.number().min(0.25).max(2).nullish().default(1),

  /**
   * A seed value for deterministic generation.
   */
  seed: z.number().int().nullish(),

  /**
   * Whether to use a conversational style.
   * @default false
   */
  conversational: z.boolean().nullish().default(false),

  /**
   * Maximum length of the output in seconds (up to 300).
   */
  length: z.number().max(300).nullish(),

  /**
   * Top-p sampling parameter. Range: 0 to 1.
   * @default 1
   */
  topP: z.number().min(0).max(1).nullish().default(1),

  /**
   * Temperature for sampling. Higher values increase randomness.
   * @default 1
   */
  temperature: z.number().min(0).nullish().default(1),
});

export type LMNTSpeechModelOptions = z.infer<
  typeof lmntSpeechModelOptionsSchema
>;
