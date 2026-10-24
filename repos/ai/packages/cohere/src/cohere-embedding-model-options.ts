import { z } from 'zod/v4';

export type CohereEmbeddingModelId =
  | 'embed-english-v3.0'
  | 'embed-multilingual-v3.0'
  | 'embed-english-light-v3.0'
  | 'embed-multilingual-light-v3.0'
  | 'embed-english-v2.0'
  | 'embed-english-light-v2.0'
  | 'embed-multilingual-v2.0'
  | (string & {});

export const cohereEmbeddingModelOptions = z.object({
  /**
   * Specifies the type of input passed to the model. Default is `search_query`.
   *
   * - "search_document": Used for embeddings stored in a vector database for search use-cases.
   * - "search_query": Used for embeddings of search queries run against a vector DB to find relevant documents.
   * - "classification": Used for embeddings passed through a text classifier.
   * - "clustering": Used for embeddings run through a clustering algorithm.
   */
  inputType: z
    .enum(['search_document', 'search_query', 'classification', 'clustering'])
    .optional(),

  /**
   * Specifies how the API will handle inputs longer than the maximum token length.
   * Default is `END`.
   *
   * - "NONE": If selected, when the input exceeds the maximum input token length will return an error.
   * - "START": Will discard the start of the input until the remaining input is exactly the maximum input token length for the model.
   * - "END": Will discard the end of the input until the remaining input is exactly the maximum input token length for the model.
   */
  truncate: z.enum(['NONE', 'START', 'END']).optional(),

  /**
   * The number of dimensions of the output embedding.
   * Only available for `embed-v4.0` and newer models.
   *
   * Possible values are `256`, `512`, `1024`, and `1536`.
   * The default is `1536`.
   */
  outputDimension: z
    .union([z.literal(256), z.literal(512), z.literal(1024), z.literal(1536)])
    .optional(),
});

export type CohereEmbeddingModelOptions = z.infer<
  typeof cohereEmbeddingModelOptions
>;
