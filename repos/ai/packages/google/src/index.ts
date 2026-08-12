export type { GoogleErrorData } from './google-error';
export type {
  GoogleLanguageModelOptions,
  /** @deprecated Use `GoogleLanguageModelOptions` instead. */
  GoogleLanguageModelOptions as GoogleGenerativeAIProviderOptions,
} from './google-language-model-options';
export type {
  GoogleProviderMetadata,
  /** @deprecated Use `GoogleProviderMetadata` instead. */
  GoogleProviderMetadata as GoogleGenerativeAIProviderMetadata,
} from './google-prompt';
export type {
  GoogleImageModelOptions,
  /** @deprecated Use `GoogleImageModelOptions` instead. */
  GoogleImageModelOptions as GoogleGenerativeAIImageProviderOptions,
} from './google-image-model-options';
export type {
  GoogleEmbeddingModelOptions,
  /** @deprecated Use `GoogleEmbeddingModelOptions` instead. */
  GoogleEmbeddingModelOptions as GoogleGenerativeAIEmbeddingProviderOptions,
} from './google-embedding-model-options';
export type {
  GoogleVideoModelOptions,
  /** @deprecated Use `GoogleVideoModelOptions` instead. */
  GoogleVideoModelOptions as GoogleGenerativeAIVideoProviderOptions,
} from './google-video-model-options';
export type {
  GoogleVideoModelId,
  /** @deprecated Use `GoogleVideoModelId` instead. */
  GoogleVideoModelId as GoogleGenerativeAIVideoModelId,
} from './google-video-settings';
export type {
  GoogleSpeechModelOptions,
  GoogleSpeechModelId,
} from './google-speech-model-options';
export type { GoogleFilesUploadOptions } from './google-files';
export type {
  GoogleLanguageModelInteractionsOptions,
  GoogleInteractionsModelId,
} from './interactions/google-interactions-language-model-options';
export type { GoogleInteractionsProviderMetadata } from './interactions/google-interactions-provider-metadata';
export type { GoogleInteractionsAgentName } from './interactions/google-interactions-agent';
export {
  createGoogle,
  google,
  /** @deprecated Use `createGoogle` instead. */
  createGoogle as createGoogleGenerativeAI,
} from './google-provider';
export type {
  GoogleProvider,
  GoogleProviderSettings,
  /** @deprecated Use `GoogleProvider` instead. */
  GoogleProvider as GoogleGenerativeAIProvider,
  /** @deprecated Use `GoogleProviderSettings` instead. */
  GoogleProviderSettings as GoogleGenerativeAIProviderSettings,
} from './google-provider';
export { GoogleRealtimeModel as Experimental_GoogleRealtimeModel } from './realtime/google-realtime-model';
export type { GoogleRealtimeModelConfig as Experimental_GoogleRealtimeModelConfig } from './realtime/google-realtime-model';
export type {
  GoogleRealtimeModelId as Experimental_GoogleRealtimeModelId,
  GoogleRealtimeModelOptions as Experimental_GoogleRealtimeModelOptions,
} from './realtime/google-realtime-model-options';

export { VERSION } from './version';
