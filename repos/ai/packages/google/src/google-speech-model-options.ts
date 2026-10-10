import {
  lazySchema,
  zodSchema,
  type InferSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export type GoogleSpeechModelId =
  | 'gemini-2.5-flash-preview-tts'
  | 'gemini-2.5-pro-preview-tts'
  | 'gemini-3.1-flash-tts-preview'
  | (string & {});

const prebuiltVoiceConfigSchema = z.object({
  voiceName: z.string(),
});

const voiceConfigSchema = z.object({
  prebuiltVoiceConfig: prebuiltVoiceConfigSchema,
});

export const googleSpeechProviderOptionsSchema = lazySchema(() =>
  zodSchema(
    z.object({
      /**
       * Multi-speaker configuration for dialogue audio. When provided, this
       * overrides the top-level `voice`. The Gemini TTS API supports up to two
       * speakers; each speaker name must match a name used in the input text.
       *
       * https://ai.google.dev/gemini-api/docs/speech-generation#multi-speaker
       */
      multiSpeakerVoiceConfig: z
        .object({
          speakerVoiceConfigs: z.array(
            z.object({
              speaker: z.string(),
              voiceConfig: voiceConfigSchema,
            }),
          ),
        })
        .optional(),
    }),
  ),
);

export type GoogleSpeechModelOptions = InferSchema<
  typeof googleSpeechProviderOptionsSchema
>;
