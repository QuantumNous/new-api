import { z } from 'zod/v4';

// Schema for camelCase input from users
export const elevenLabsSpeechModelOptionsSchema = z.object({
  languageCode: z.string().optional(),
  voiceSettings: z
    .object({
      stability: z.number().min(0).max(1).optional(),
      similarityBoost: z.number().min(0).max(1).optional(),
      style: z.number().min(0).max(1).optional(),
      useSpeakerBoost: z.boolean().optional(),
    })
    .optional(),
  pronunciationDictionaryLocators: z
    .array(
      z.object({
        pronunciationDictionaryId: z.string(),
        versionId: z.string().optional(),
      }),
    )
    .max(3)
    .optional(),
  seed: z.number().min(0).max(4294967295).optional(),
  previousText: z.string().optional(),
  nextText: z.string().optional(),
  previousRequestIds: z.array(z.string()).max(3).optional(),
  nextRequestIds: z.array(z.string()).max(3).optional(),
  applyTextNormalization: z.enum(['auto', 'on', 'off']).optional(),
  applyLanguageTextNormalization: z.boolean().optional(),
  enableLogging: z.boolean().optional(),
});

export type ElevenLabsSpeechModelOptions = z.infer<
  typeof elevenLabsSpeechModelOptionsSchema
>;
