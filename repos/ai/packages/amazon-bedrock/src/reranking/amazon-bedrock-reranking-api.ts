import { lazySchema, zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

// https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent-runtime_Rerank.html
export type AmazonBedrockRerankingInput = {
  nextToken?: string;
  queries: [{ type: 'TEXT'; textQuery: { text: string } }];
  rerankingConfiguration: {
    type: 'BEDROCK_RERANKING_MODEL';
    bedrockRerankingConfiguration: {
      modelConfiguration: {
        modelArn: string;
        additionalModelRequestFields?: Record<string, unknown>;
      };
      numberOfResults?: number;
    };
  };
  sources: {
    type: 'INLINE';
    inlineDocumentSource:
      | {
          type: 'TEXT';
          textDocument: { text: string };
        }
      | {
          type: 'JSON';
          jsonDocument: unknown;
        };
  }[];
};

export const amazonBedrockRerankingResponseSchema = lazySchema(() =>
  zodSchema(
    z.object({
      results: z.array(
        z.object({
          index: z.number(),
          relevanceScore: z.number(),
        }),
      ),
      nextToken: z.string().optional(),
    }),
  ),
);
