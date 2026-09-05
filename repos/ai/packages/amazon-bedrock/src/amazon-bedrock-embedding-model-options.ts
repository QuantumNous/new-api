import { z } from 'zod/v4';

export type AmazonBedrockEmbeddingModelId =
  | 'amazon.titan-embed-text-v1'
  | 'amazon.titan-embed-text-v2:0'
  | 'cohere.embed-english-v3'
  | 'cohere.embed-multilingual-v3'
  | (string & {});

export const amazonBedrockEmbeddingModelOptionsSchema = z.object({
  /**
   * The number of dimensions the resulting output embeddings should have (defaults to 1024).
   * Only supported in amazon.titan-embed-text-v2:0.
   */
  dimensions: z
    .union([z.literal(1024), z.literal(512), z.literal(256)])
    .optional(),

  /**
   * Flag indicating whether or not to normalize the output embeddings. Defaults to true.
   * Only supported in amazon.titan-embed-text-v2:0.
   */
  normalize: z.boolean().optional(),

  /**
   * The number of dimensions for Nova embedding models (defaults to 1024).
   * Supported values: 256, 384, 1024, 3072.
   * Only supported in amazon.nova-* embedding models.
   */
  embeddingDimension: z
    .union([z.literal(256), z.literal(384), z.literal(1024), z.literal(3072)])
    .optional(),

  /**
   * The purpose of the embedding. Defaults to 'GENERIC_INDEX'.
   * Only supported in amazon.nova-* embedding models.
   */
  embeddingPurpose: z
    .enum([
      'GENERIC_INDEX',
      'TEXT_RETRIEVAL',
      'IMAGE_RETRIEVAL',
      'VIDEO_RETRIEVAL',
      'DOCUMENT_RETRIEVAL',
      'AUDIO_RETRIEVAL',
      'GENERIC_RETRIEVAL',
      'CLASSIFICATION',
      'CLUSTERING',
    ])
    .optional(),

  /**
   * Input type for Cohere embedding models on Bedrock.
   * Common values: `search_document`, `search_query`, `classification`, `clustering`.
   * If not set, the provider defaults to `search_query`.
   */
  inputType: z
    .enum(['search_document', 'search_query', 'classification', 'clustering'])
    .optional(),

  /**
   * Truncation behavior when input exceeds the model's context length.
   * Supported in Cohere and Nova embedding models. Defaults to 'END' for Nova models.
   */
  truncate: z.enum(['NONE', 'START', 'END']).optional(),

  /**
   * The number of dimensions the resulting output embeddings should have (defaults to 1536).
   * Only supported in cohere.embed-v4:0 and newer Cohere embedding models.
   */
  outputDimension: z
    .union([z.literal(256), z.literal(512), z.literal(1024), z.literal(1536)])
    .optional(),
});

export type AmazonBedrockEmbeddingModelOptions = z.infer<
  typeof amazonBedrockEmbeddingModelOptionsSchema
>;
