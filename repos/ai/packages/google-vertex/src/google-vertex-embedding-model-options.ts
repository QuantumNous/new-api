import { z } from 'zod/v4';

// https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/text-embeddings-api
export type GoogleVertexEmbeddingModelId =
  | 'textembedding-gecko'
  | 'textembedding-gecko@001'
  | 'textembedding-gecko@003'
  | 'textembedding-gecko-multilingual'
  | 'textembedding-gecko-multilingual@001'
  | 'text-multilingual-embedding-002'
  | 'text-embedding-004'
  | 'text-embedding-005'
  | 'gemini-embedding-001'
  | 'gemini-embedding-2'
  | 'gemini-embedding-2-preview'
  | (string & {});

export const googleVertexEmbeddingModelOptions = z.object({
  /**
   * Optional. Optional reduced dimension for the output embedding.
   * If set, excessive values in the output embedding are truncated from the end.
   */
  outputDimensionality: z.number().optional(),

  /**
   * Optional. Specifies the task type for generating embeddings.
   * Supported task types:
   * - SEMANTIC_SIMILARITY: Optimized for text similarity.
   * - CLASSIFICATION: Optimized for text classification.
   * - CLUSTERING: Optimized for clustering texts based on similarity.
   * - RETRIEVAL_DOCUMENT: Optimized for document retrieval.
   * - RETRIEVAL_QUERY: Optimized for query-based retrieval.
   * - QUESTION_ANSWERING: Optimized for answering questions.
   * - FACT_VERIFICATION: Optimized for verifying factual information.
   * - CODE_RETRIEVAL_QUERY: Optimized for retrieving code blocks based on natural language queries.
   */
  taskType: z
    .enum([
      'SEMANTIC_SIMILARITY',
      'CLASSIFICATION',
      'CLUSTERING',
      'RETRIEVAL_DOCUMENT',
      'RETRIEVAL_QUERY',
      'QUESTION_ANSWERING',
      'FACT_VERIFICATION',
      'CODE_RETRIEVAL_QUERY',
    ])
    .optional(),

  /**
   * Optional. The title of the document being embedded.
   * Only valid when task_type is set to 'RETRIEVAL_DOCUMENT'.
   * Helps the model produce better embeddings by providing additional context.
   */
  title: z.string().optional(),

  /**
   * Optional. When set to true, input text will be truncated. When set to false,
   * an error is returned if the input text is longer than the maximum length supported by the model. Defaults to true.
   */
  autoTruncate: z.boolean().optional(),
});

export type GoogleVertexEmbeddingModelOptions = z.infer<
  typeof googleVertexEmbeddingModelOptions
>;
