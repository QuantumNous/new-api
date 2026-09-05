import { z } from 'zod/v4';

export const AmazonBedrockErrorSchema = z.object({
  message: z.string(),
  type: z.string().nullish(),
});
