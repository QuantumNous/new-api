import {
  lazySchema,
  zodSchema,
  type InferSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

/**
 * Provider options schema for Together AI image generation.
 */
export const togetheraiImageModelOptionsSchema = lazySchema(() =>
  zodSchema(
    z.looseObject({
      /**
       * Number of generation steps. Higher values can improve quality.
       */
      steps: z.number().nullish(),

      /**
       * Guidance scale for image generation.
       */
      guidance: z.number().nullish(),

      /**
       * Negative prompt to guide what to avoid.
       */
      negative_prompt: z.string().nullish(),

      /**
       * Disable the safety checker for image generation.
       * When true, the API will not reject images flagged as potentially NSFW.
       * Not available for Flux Schnell Free and Flux Pro models.
       */
      disable_safety_checker: z.boolean().nullish(),
    }),
  ),
);

export type TogetherAIImageModelOptions = InferSchema<
  typeof togetheraiImageModelOptionsSchema
>;
