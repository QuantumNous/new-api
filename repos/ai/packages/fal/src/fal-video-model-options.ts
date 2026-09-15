import { lazySchema, zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export type FalVideoModelOptions = {
  loop?: boolean | null;
  motionStrength?: number | null;
  pollIntervalMs?: number | null;
  pollTimeoutMs?: number | null;
  resolution?: string | null;
  negativePrompt?: string | null;
  promptOptimizer?: boolean | null;
  [key: string]: unknown; // For passthrough
};

// Provider options schema for FAL video generation
export const falVideoModelOptionsSchema = lazySchema(() =>
  zodSchema(
    z.looseObject({
      // Video loop - only for Luma models
      loop: z.boolean().nullish(),

      // Motion strength (provider-specific)
      motionStrength: z.number().min(0).max(1).nullish(),

      // Polling configuration
      pollIntervalMs: z.number().positive().nullish(),
      pollTimeoutMs: z.number().positive().nullish(),

      // Resolution (model-specific, e.g., '480p', '720p', '1080p')
      resolution: z.string().nullish(),

      // Model-specific parameters
      negativePrompt: z.string().nullish(),
      promptOptimizer: z.boolean().nullish(),
    }),
  ),
);
