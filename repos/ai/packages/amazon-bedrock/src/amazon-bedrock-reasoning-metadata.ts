import { z } from 'zod/v4';

export const amazonBedrockReasoningMetadataSchema = z.object({
  signature: z.string().optional(),
  redactedData: z.string().optional(),
});

export type AmazonBedrockReasoningMetadata = z.infer<
  typeof amazonBedrockReasoningMetadataSchema
>;
