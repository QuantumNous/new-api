import { z } from 'zod/v4';

// https://www.baseten.co/library/tag/embedding/
// Pass in the model URL directly, we won't be using the model ID

export type BasetenEmbeddingModelId = string & {};

export const basetenEmbeddingModelOptions = z.object({});

export type BasetenEmbeddingModelOptions = z.infer<
  typeof basetenEmbeddingModelOptions
>;
