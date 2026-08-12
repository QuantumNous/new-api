import {
  lazySchema,
  zodSchema,
  type FlexibleSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export type VoyageRerankingModelId =
  | 'rerank-2.5'
  | 'rerank-2.5-lite'
  | 'rerank-2'
  | 'rerank-2-lite'
  | 'rerank-1'
  | 'rerank-lite-1'
  | (string & {});

export type VoyageRerankingModelOptions = {
  returnDocuments?: boolean;
  truncation?: boolean;
};

export const voyageRerankingModelOptionsSchema: FlexibleSchema<VoyageRerankingModelOptions> =
  lazySchema(() =>
    zodSchema(
      z.object({
        returnDocuments: z.boolean().optional(),
        truncation: z.boolean().optional(),
      }),
    ),
  );
