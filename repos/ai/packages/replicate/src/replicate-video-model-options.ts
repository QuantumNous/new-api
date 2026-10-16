import { lazySchema, zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export type ReplicateVideoModelOptions = {
  // Polling configuration
  pollIntervalMs?: number | null;
  pollTimeoutMs?: number | null;
  maxWaitTimeInSeconds?: number | null;

  // Common video generation options
  guidance_scale?: number | null;
  num_inference_steps?: number | null;

  // Stable Video Diffusion specific
  motion_bucket_id?: number | null;
  cond_aug?: number | null;
  decoding_t?: number | null;
  video_length?: string | null;
  sizing_strategy?: string | null;
  frames_per_second?: number | null;

  // MiniMax specific
  prompt_optimizer?: boolean | null;

  [key: string]: unknown; // For passthrough
};

export const replicateVideoModelOptionsSchema = lazySchema(() =>
  zodSchema(
    z
      .object({
        pollIntervalMs: z.number().positive().nullish(),
        pollTimeoutMs: z.number().positive().nullish(),
        maxWaitTimeInSeconds: z.number().positive().nullish(),
        guidance_scale: z.number().nullish(),
        num_inference_steps: z.number().nullish(),
        motion_bucket_id: z.number().nullish(),
        cond_aug: z.number().nullish(),
        decoding_t: z.number().nullish(),
        video_length: z.string().nullish(),
        sizing_strategy: z.string().nullish(),
        frames_per_second: z.number().nullish(),
        prompt_optimizer: z.boolean().nullish(),
      })
      .loose(),
  ),
);
