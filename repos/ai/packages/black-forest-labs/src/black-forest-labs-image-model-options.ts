import {
  lazySchema,
  zodSchema,
  type InferSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export const blackForestLabsImageModelOptionsSchema = lazySchema(() =>
  zodSchema(
    z.object({
      imagePrompt: z.string().optional(),
      imagePromptStrength: z.number().min(0).max(1).optional(),
      /** @deprecated use prompt.images instead */
      inputImage: z.string().optional(),
      /** @deprecated use prompt.images instead */
      inputImage2: z.string().optional(),
      /** @deprecated use prompt.images instead */
      inputImage3: z.string().optional(),
      /** @deprecated use prompt.images instead */
      inputImage4: z.string().optional(),
      /** @deprecated use prompt.images instead */
      inputImage5: z.string().optional(),
      /** @deprecated use prompt.images instead */
      inputImage6: z.string().optional(),
      /** @deprecated use prompt.images instead */
      inputImage7: z.string().optional(),
      /** @deprecated use prompt.images instead */
      inputImage8: z.string().optional(),
      /** @deprecated use prompt.images instead */
      inputImage9: z.string().optional(),
      /** @deprecated use prompt.images instead */
      inputImage10: z.string().optional(),
      steps: z.number().int().positive().optional(),
      guidance: z.number().min(0).optional(),
      width: z.number().int().min(256).max(1920).optional(),
      height: z.number().int().min(256).max(1920).optional(),
      outputFormat: z.enum(['jpeg', 'png']).optional(),
      promptUpsampling: z.boolean().optional(),
      raw: z.boolean().optional(),
      safetyTolerance: z.number().int().min(0).max(6).optional(),
      webhookSecret: z.string().optional(),
      webhookUrl: z.url().optional(),
      pollIntervalMillis: z.number().int().positive().optional(),
      pollTimeoutMillis: z.number().int().positive().optional(),
    }),
  ),
);

export type BlackForestLabsImageModelOptions = InferSchema<
  typeof blackForestLabsImageModelOptionsSchema
>;
