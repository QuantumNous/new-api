import { lazySchema, zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

// https://docs.aws.amazon.com/bedrock/latest/userguide/rerank-supported.html
export type AmazonBedrockRerankingModelId =
  | 'amazon.rerank-v1:0'
  | 'cohere.rerank-v3-5:0'
  | (string & {});

export type AmazonBedrockRerankingModelOptions = {
  /**
   * If the total number of results was greater than could fit in a response, a token is returned in the nextToken field. You can enter that token in this field to return the next batch of results.
   */
  nextToken?: string;

  /**
   * Additional model request fields to pass to the model.
   */
  additionalModelRequestFields?: Record<string, unknown>;
};

export const amazonBedrockRerankingModelOptionsSchema = lazySchema(() =>
  zodSchema(
    z.object({
      /**
       * If the total number of results was greater than could fit in a response, a token is returned in the nextToken field. You can enter that token in this field to return the next batch of results.
       */
      nextToken: z.string().optional(),

      /**
       * Additional model request fields to pass to the model.
       */
      additionalModelRequestFields: z.record(z.string(), z.any()).optional(),
    }),
  ),
);
