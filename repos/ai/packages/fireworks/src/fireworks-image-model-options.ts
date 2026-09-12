import {
  lazySchema,
  zodSchema,
  type InferSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export const fireworksImageModelOptionsSchema = lazySchema(() =>
  zodSchema(
    z.looseObject({
      /**
       * Classifier-free guidance scale for the image diffusion process.
       */
      guidance_scale: z.number().optional(),

      /**
       * Number of denoising steps for the image generation process.
       */
      num_inference_steps: z.number().int().optional(),

      /**
       * Desired output image format.
       */
      output_format: z.enum(['jpeg', 'png']).optional(),

      /**
       * URL to receive webhook notifications for async Kontext requests.
       */
      webhook_url: z.string().optional(),

      /**
       * Secret for webhook signature verification.
       */
      webhook_secret: z.string().optional(),

      /**
       * Whether Fireworks should automatically modify the prompt for more creative generation.
       */
      prompt_upsampling: z.boolean().optional(),

      /**
       * Moderation tolerance level for inputs and outputs.
       */
      safety_tolerance: z.number().int().min(0).max(6).optional(),

      /**
       * Guidance scale for legacy image_generation models.
       */
      cfg_scale: z.number().optional(),

      /**
       * Number of generation steps for legacy image_generation models.
       */
      steps: z.number().int().optional(),
    }),
  ),
);

export type FireworksImageModelOptions = InferSchema<
  typeof fireworksImageModelOptionsSchema
>;
