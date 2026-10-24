import { lazySchema, zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export type GoogleVideoModelOptions = {
  // Polling configuration
  pollIntervalMs?: number | null;
  pollTimeoutMs?: number | null;

  // Video generation options
  personGeneration?: 'dont_allow' | 'allow_adult' | 'allow_all' | null;
  negativePrompt?: string | null;

  // Reference images (for style/asset reference)
  referenceImages?: Array<{
    bytesBase64Encoded?: string;
    gcsUri?: string;
  }> | null;

  [key: string]: unknown; // For passthrough
};

export const googleVideoModelOptionsSchema = lazySchema(() =>
  zodSchema(
    z.looseObject({
      pollIntervalMs: z.number().positive().nullish(),
      pollTimeoutMs: z.number().positive().nullish(),
      personGeneration: z
        .enum(['dont_allow', 'allow_adult', 'allow_all'])
        .nullish(),
      negativePrompt: z.string().nullish(),
      referenceImages: z
        .array(
          z.object({
            bytesBase64Encoded: z.string().nullish(),
            gcsUri: z.string().nullish(),
          }),
        )
        .nullish(),
    }),
  ),
);
