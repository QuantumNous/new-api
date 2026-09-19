import {
  lazySchema,
  zodSchema,
  type InferSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export type GroqTranscriptionModelId =
  | 'whisper-large-v3-turbo'
  | 'whisper-large-v3'
  | (string & {});

// https://console.groq.com/docs/speech-to-text
export const groqTranscriptionModelOptions = lazySchema(() =>
  zodSchema(
    z.object({
      language: z.string().nullish(),
      prompt: z.string().nullish(),
      responseFormat: z.string().nullish(),
      temperature: z.number().min(0).max(1).nullish(),
      timestampGranularities: z.array(z.string()).nullish(),
    }),
  ),
);

export type GroqTranscriptionModelOptions = InferSchema<
  typeof groqTranscriptionModelOptions
>;
