import type { DeepSeekLanguageModelChatOptions } from '@ai-sdk/deepseek';

export type AzureDeepSeekLanguageModelOptions = Omit<
  DeepSeekLanguageModelChatOptions,
  'thinking'
>;
/** @deprecated Use `AzureDeepSeekLanguageModelOptions` instead. */
export type AzureDeepSeekChatOptions = AzureDeepSeekLanguageModelOptions;
export type {
  OpenAILanguageModelResponsesOptions,
  /** @deprecated Use `OpenAILanguageModelResponsesOptions` instead. */
  OpenAILanguageModelResponsesOptions as OpenAIResponsesProviderOptions,
  OpenAILanguageModelChatOptions,
  /** @deprecated Use `OpenAILanguageModelChatOptions` instead. */
  OpenAILanguageModelChatOptions as OpenAIChatLanguageModelOptions,
} from '@ai-sdk/openai';

export { azure, createAzure } from './azure-openai-provider';
export type {
  AzureOpenAIProvider,
  AzureOpenAIProviderSettings,
} from './azure-openai-provider';
export type {
  AzureResponsesProviderMetadata,
  AzureResponsesReasoningProviderMetadata,
  AzureResponsesTextProviderMetadata,
  AzureResponsesSourceDocumentProviderMetadata,
} from './azure-openai-provider-metadata';
export { VERSION } from './version';
