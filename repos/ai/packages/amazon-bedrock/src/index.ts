export type { AnthropicProviderOptions } from '@ai-sdk/anthropic';

export type { AmazonBedrockEmbeddingModelOptions } from './amazon-bedrock-embedding-model-options';
export type {
  AmazonBedrockLanguageModelChatOptions,
  /** @deprecated Use `AmazonBedrockLanguageModelChatOptions` instead. */
  AmazonBedrockLanguageModelChatOptions as AmazonBedrockLanguageModelOptions,
  /** @deprecated Use `AmazonBedrockLanguageModelChatOptions` instead. */
  AmazonBedrockLanguageModelChatOptions as BedrockProviderOptions,
} from './amazon-bedrock-chat-language-model-options';
export {
  amazonBedrock,
  /** @deprecated Use `amazonBedrock` instead. */
  amazonBedrock as bedrock,
  createAmazonBedrock,
} from './amazon-bedrock-provider';
export type {
  AmazonBedrockProvider,
  AmazonBedrockProviderSettings,
} from './amazon-bedrock-provider';
export type {
  AmazonBedrockRerankingModelOptions,
  /** @deprecated Use `AmazonBedrockRerankingModelOptions` instead. */
  AmazonBedrockRerankingModelOptions as BedrockRerankingOptions,
} from './reranking/amazon-bedrock-reranking-model-options';
export { VERSION } from './version';
