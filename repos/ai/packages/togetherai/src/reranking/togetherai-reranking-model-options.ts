import {
  lazySchema,
  zodSchema,
  type FlexibleSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

// see https://docs.together.ai/docs/serverless-models#rerank-models
export type TogetherAIRerankingModelId =
  | 'Salesforce/Llama-Rank-v1'
  | 'mixedbread-ai/Mxbai-Rerank-Large-V2'
  | (string & {});

export type TogetherAIRerankingModelOptions = {
  /**
   * List of keys in the JSON Object document to rank by.
   * Defaults to use all supplied keys for ranking.
   *
   * @example ["title", "text"]
   */
  rankFields?: string[];
};

export const togetheraiRerankingModelOptionsSchema: FlexibleSchema<TogetherAIRerankingModelOptions> =
  lazySchema(() =>
    zodSchema(
      z.object({
        rankFields: z.array(z.string()).optional(),
      }),
    ),
  );
