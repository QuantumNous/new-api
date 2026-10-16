import {
  lazySchema,
  zodSchema,
  type FlexibleSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

// https://docs.cohere.com/docs/rerank
export type CohereRerankingModelId =
  | 'rerank-v3.5'
  | 'rerank-english-v3.0'
  | 'rerank-multilingual-v3.0'
  | (string & {});

export type CohereRerankingModelOptions = {
  /**
   * Long documents will be automatically truncated to the specified number of tokens.
   *
   * @default 4096
   */
  maxTokensPerDoc?: number;

  /**
   * The priority of the request.
   *
   * @default 0
   */
  priority?: number;
};

export const cohereRerankingModelOptionsSchema: FlexibleSchema<CohereRerankingModelOptions> =
  lazySchema(() =>
    zodSchema(
      z.object({
        maxTokensPerDoc: z.number().optional(),
        priority: z.number().optional(),
      }),
    ),
  );
