export type {
  CohereLanguageModelChatOptions,
  /** @deprecated Use `CohereLanguageModelChatOptions` instead. */
  CohereLanguageModelChatOptions as CohereLanguageModelOptions,
  /** @deprecated Use `CohereLanguageModelChatOptions` instead. */
  CohereLanguageModelChatOptions as CohereChatModelOptions,
} from './cohere-chat-language-model-options';
export { cohere, createCohere } from './cohere-provider';
export type { CohereProvider, CohereProviderSettings } from './cohere-provider';
export type { CohereEmbeddingModelOptions } from './cohere-embedding-model-options';
export type {
  CohereRerankingModelOptions,
  /** @deprecated Use `CohereRerankingModelOptions` instead. */
  CohereRerankingModelOptions as CohereRerankingOptions,
} from './reranking/cohere-reranking-model-options';
export { VERSION } from './version';
