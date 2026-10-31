import { z } from 'zod/v4';
import { createJsonErrorResponseHandler } from '@ai-sdk/provider-utils';

export const lmntErrorDataSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.number(),
  }),
});

export type LMNTErrorData = z.infer<typeof lmntErrorDataSchema>;

export const lmntFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: lmntErrorDataSchema,
  errorToMessage: data => data.error.message,
});
