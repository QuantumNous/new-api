import { z } from 'zod/v4';

export type VoyageEmbeddingModelId =
  | 'voyage-4-large'
  | 'voyage-4'
  | 'voyage-4-lite'
  | 'voyage-4-nano'
  | 'voyage-code-3.5'
  | 'voyage-code-3'
  | 'voyage-3-large'
  | 'voyage-3.5'
  | 'voyage-3.5-lite'
  | 'voyage-3'
  | 'voyage-3-lite'
  | 'voyage-finance-2'
  | 'voyage-law-2'
  | 'voyage-multilingual-2'
  | 'voyage-code-2'
  | 'voyage-2'
  | (string & {});

export const voyageEmbeddingModelOptions = z.object({
  inputType: z.enum(['query', 'document']).nullable().optional(),
  truncation: z.boolean().optional(),
  outputDimension: z.number().optional(),
  outputDtype: z
    .enum(['float', 'int8', 'uint8', 'binary', 'ubinary'])
    .optional(),
});

export type VoyageEmbeddingModelOptions = z.infer<
  typeof voyageEmbeddingModelOptions
>;
