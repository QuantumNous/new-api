import {
  lazySchema,
  zodSchema,
  type InferSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export const amazonBedrockImageModelOptionsSchema = lazySchema(() =>
  zodSchema(
    z.object({
      quality: z.enum(['standard', 'premium']).optional(),
      negativeText: z.string().optional(),
      cfgScale: z.number().optional(),
      style: z
        .enum([
          '3D_ANIMATED_FAMILY_FILM',
          'DESIGN_SKETCH',
          'FLAT_VECTOR_ILLUSTRATION',
          'GRAPHIC_NOVEL_ILLUSTRATION',
          'MAXIMALISM',
          'MIDCENTURY_RETRO',
          'PHOTOREALISM',
          'SOFT_DIGITAL_PAINTING',
        ])
        .optional(),
      taskType: z
        .enum([
          'TEXT_IMAGE',
          'IMAGE_VARIATION',
          'INPAINTING',
          'OUTPAINTING',
          'BACKGROUND_REMOVAL',
        ])
        .optional(),
      maskPrompt: z.string().optional(),
      outPaintingMode: z.enum(['DEFAULT', 'PRECISE']).optional(),
      similarityStrength: z.number().optional(),
    }),
  ),
);

export type AmazonBedrockImageModelOptions = InferSchema<
  typeof amazonBedrockImageModelOptionsSchema
>;
