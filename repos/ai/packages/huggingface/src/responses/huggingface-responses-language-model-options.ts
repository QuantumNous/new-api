import { z } from 'zod/v4';

export const huggingfaceLanguageModelResponsesOptions = z.object({
  metadata: z.record(z.string(), z.string()).optional(),
  instructions: z.string().optional(),
  strictJsonSchema: z.boolean().optional(),
  reasoningEffort: z.string().optional(),
});

export type HuggingFaceLanguageModelResponsesOptions = z.infer<
  typeof huggingfaceLanguageModelResponsesOptions
>;
