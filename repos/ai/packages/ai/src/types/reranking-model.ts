import type { RerankingModelV3, RerankingModelV4 } from '@ai-sdk/provider';

/**
 * Reranking model that is used by the AI SDK.
 */
export type RerankingModel = string | RerankingModelV4 | RerankingModelV3;
