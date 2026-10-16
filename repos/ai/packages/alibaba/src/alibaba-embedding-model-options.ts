import { z } from 'zod/v4';

export type AlibabaEmbeddingModelId =
  | 'text-embedding-v4'
  | 'text-embedding-v3'
  | (string & {});

export const alibabaEmbeddingModelOptions = z.object({
  /**
   * Differentiates query text from document text for asymmetric retrieval tasks.
   * Defaults to `document`.
   */
  textType: z.enum(['query', 'document']).optional(),

  /**
   * The dimension of the output embedding vectors. Defaults to 1024.
   *
   * `text-embedding-v4` also supports 1536 and 2048 dimensions.
   */
  dimension: z.number().optional(),

  /**
   * The output vector type. Defaults to `dense`.
   *
   * Sparse-only output is not supported by the AI SDK embedding interface,
   * which requires dense number arrays.
   */
  outputType: z.enum(['dense', 'sparse', 'dense&sparse']).optional(),
});

export type AlibabaEmbeddingModelOptions = z.infer<
  typeof alibabaEmbeddingModelOptions
>;
