import { z } from 'zod/v4';
import { createJsonErrorResponseHandler } from '@ai-sdk/provider-utils';

export const deepgramErrorDataSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.number(),
  }),
});

export type DeepgramErrorData = z.infer<typeof deepgramErrorDataSchema>;

export const deepgramFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: deepgramErrorDataSchema,
  errorToMessage: data => data.error.message,
});
