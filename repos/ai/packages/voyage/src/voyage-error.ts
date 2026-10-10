import { createJsonErrorResponseHandler } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

const voyageErrorDataSchema = z.object({
  detail: z.string(),
});

export type VoyageErrorData = z.infer<typeof voyageErrorDataSchema>;

export const voyageFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: voyageErrorDataSchema,
  errorToMessage: data => data.detail,
});
