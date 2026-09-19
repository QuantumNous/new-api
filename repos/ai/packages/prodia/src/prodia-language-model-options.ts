import {
  lazySchema,
  zodSchema,
  type InferSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export const prodiaLanguageModelOptionsSchema = lazySchema(() =>
  zodSchema(
    z.object({
      /**
       * Aspect ratio for the output image.
       */
      aspectRatio: z
        .enum([
          '1:1',
          '2:3',
          '3:2',
          '4:5',
          '5:4',
          '4:7',
          '7:4',
          '9:16',
          '16:9',
          '9:21',
          '21:9',
        ])
        .optional(),
    }),
  ),
);

export type ProdiaLanguageModelOptions = InferSchema<
  typeof prodiaLanguageModelOptionsSchema
>;
