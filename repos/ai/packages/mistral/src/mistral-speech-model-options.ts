import { z } from 'zod/v4';

export type MistralSpeechModelId = 'voxtral-mini-tts-2603' | (string & {});

export const mistralSpeechModelOptions = z.object({
  /**
   * Base64-encoded reference audio for one-off voice cloning.
   *
   * When provided, this takes precedence over the standard `voice` option.
   */
  refAudio: z.string().min(1).optional(),
});

export type MistralSpeechModelOptions = z.infer<
  typeof mistralSpeechModelOptions
>;
