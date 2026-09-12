import {
  lazySchema,
  zodSchema,
  type InferSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

/**
 * Provider options schema for Replicate image generation.
 *
 * Note: Different Replicate models support different parameters.
 * This schema includes common parameters, but you can pass any
 * model-specific parameters through the passthrough.
 */
export const replicateImageModelOptionsSchema = lazySchema(() =>
  zodSchema(
    z.looseObject({
      /**
       * Maximum time in seconds to wait for the prediction to complete in sync mode.
       * By default, Replicate uses sync mode with a 60-second timeout.
       *
       * - When not specified: Uses default 60-second sync wait (`prefer: wait`)
       * - When set to a positive number: Uses that duration (`prefer: wait=N`)
       */
      maxWaitTimeInSeconds: z.number().positive().nullish(),

      /**
       * Guidance scale for classifier-free guidance.
       * Higher values make the output more closely match the prompt.
       */
      guidance_scale: z.number().nullish(),

      /**
       * Number of denoising steps. More steps = higher quality but slower.
       */
      num_inference_steps: z.number().nullish(),

      /**
       * Negative prompt to guide what to avoid in the generation.
       */
      negative_prompt: z.string().nullish(),

      /**
       * Output image format.
       */
      output_format: z.enum(['png', 'jpg', 'webp']).nullish(),

      /**
       * Output image quality (1-100). Only applies to jpg and webp.
       */
      output_quality: z.number().min(1).max(100).nullish(),

      /**
       * Strength of the transformation for img2img (0-1).
       * Lower values keep more of the original image.
       */
      strength: z.number().min(0).max(1).nullish(),
    }),
  ),
);

export type ReplicateImageModelOptions = InferSchema<
  typeof replicateImageModelOptionsSchema
>;
