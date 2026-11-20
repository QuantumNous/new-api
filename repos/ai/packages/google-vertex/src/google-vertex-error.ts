import { createJsonErrorResponseHandler } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

const googleVertexErrorDataSchema = z.object({
  error: z.object({
    code: z.number().nullable(),
    message: z.string(),
    status: z.string(),
  }),
});

export type GoogleVertexErrorData = z.infer<typeof googleVertexErrorDataSchema>;

export const googleVertexFailedResponseHandler = createJsonErrorResponseHandler(
  {
    errorSchema: googleVertexErrorDataSchema,
    errorToMessage: data => data.error.message,
  },
);
