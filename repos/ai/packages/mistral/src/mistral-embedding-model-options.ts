import { z } from 'zod/v4';

export type MistralEmbeddingModelId =
  | 'mistral-embed'
  | 'codestral-embed-2505'
  | (string & {});

export const mistralEmbeddingModelOptions = z.object({
  /**
   * Additional metadata to attach to the embedding request.
   */
  metadata: z.record(z.string(), z.any()).optional(),

  /**
   * The dimension of the output embeddings when supported by the model.
   */
  outputDimension: z.number().int().positive().optional(),

  /**
   * The data type of the output embeddings when supported by the model.
   */
  outputDtype: z
    .enum(['float', 'int8', 'uint8', 'binary', 'ubinary'])
    .optional(),
});

export type MistralEmbeddingModelOptions = z.infer<
  typeof mistralEmbeddingModelOptions
>;
