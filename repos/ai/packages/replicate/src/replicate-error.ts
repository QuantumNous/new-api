import { createJsonErrorResponseHandler } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

const replicateErrorSchema = z.object({
  detail: z.string().optional(),
  error: z.string().optional(),
});

export const replicateFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: replicateErrorSchema,
  errorToMessage: error =>
    error.detail ?? error.error ?? 'Unknown Replicate error',
});
