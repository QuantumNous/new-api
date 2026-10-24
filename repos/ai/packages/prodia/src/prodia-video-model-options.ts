import {
  lazySchema,
  zodSchema,
  type InferSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export const prodiaVideoModelOptionsSchema = lazySchema(() =>
  zodSchema(
    z.object({
      /**
       * Video resolution (e.g. "480p", "720p").
       */
      resolution: z.string().optional(),
    }),
  ),
);

export type ProdiaVideoModelOptions = InferSchema<
  typeof prodiaVideoModelOptionsSchema
>;
