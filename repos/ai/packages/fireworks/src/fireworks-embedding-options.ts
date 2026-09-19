import { z } from 'zod/v4';

// Below is just a subset of the available models.
export type FireworksEmbeddingModelId =
  | 'nomic-ai/nomic-embed-text-v1.5'
  | (string & {});

export const fireworksEmbeddingModelOptions = z.object({});

export type FireworksEmbeddingModelOptions = z.infer<
  typeof fireworksEmbeddingModelOptions
>;
