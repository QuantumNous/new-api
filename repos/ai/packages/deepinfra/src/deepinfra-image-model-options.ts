import {
  lazySchema,
  zodSchema,
  type InferSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export const deepInfraImageModelOptionsSchema = lazySchema(() =>
  zodSchema(
    z.looseObject({
      negative_prompt: z.string().nullish(),
      num_inference_steps: z.number().nullish(),
      guidance_scale: z.number().nullish(),
      guidance: z.number().nullish(),
      response_format: z.enum(['b64_json']).nullish(),
      quality: z.string().nullish(),
      style: z.string().nullish(),
      user: z.string().nullish(),
    }),
  ),
);

export type DeepInfraImageModelOptions = InferSchema<
  typeof deepInfraImageModelOptionsSchema
>;
