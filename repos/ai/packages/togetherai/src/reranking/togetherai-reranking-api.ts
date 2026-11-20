import type { JSONObject } from '@ai-sdk/provider';
import { lazySchema, zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

// https://docs.together.ai/reference/rerank-1
export type TogetherAIRerankingInput = {
  model: string;
  query: string;
  documents: JSONObject[] | string[];
  top_n: number | undefined;
  return_documents: boolean | undefined;
  rank_fields: string[] | undefined;
};

export const togetheraiErrorSchema = lazySchema(() =>
  zodSchema(
    z.object({
      error: z.object({
        message: z.string(),
      }),
    }),
  ),
);

export const togetheraiRerankingResponseSchema = lazySchema(() =>
  zodSchema(
    z.object({
      id: z.string().nullish(),
      model: z.string().nullish(),
      results: z.array(
        z.object({
          index: z.number(),
          relevance_score: z.number(),
        }),
      ),
      usage: z.object({
        prompt_tokens: z.number(),
        completion_tokens: z.number(),
        total_tokens: z.number(),
      }),
    }),
  ),
);
