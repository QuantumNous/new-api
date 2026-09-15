import { z } from 'zod/v4';
import { createJsonErrorResponseHandler } from '@ai-sdk/provider-utils';

export const assemblyaiErrorDataSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.number(),
  }),
});

export type AssemblyAIErrorData = z.infer<typeof assemblyaiErrorDataSchema>;

export const assemblyaiFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: assemblyaiErrorDataSchema,
  errorToMessage: data => data.error.message,
});
