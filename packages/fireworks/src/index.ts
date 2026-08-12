export type {
  FireworksLanguageModelOptions,
  /** @deprecated Use `FireworksLanguageModelOptions` instead. */
  FireworksLanguageModelOptions as FireworksProviderOptions,
} from './fireworks-chat-options';
export type {
  FireworksEmbeddingModelId,
  FireworksEmbeddingModelOptions,
  /** @deprecated Use `FireworksEmbeddingModelOptions` instead. */
  FireworksEmbeddingModelOptions as FireworksEmbeddingProviderOptions,
} from './fireworks-embedding-options';
export { FireworksImageModel } from './fireworks-image-model';
export type { FireworksImageModelId } from './fireworks-image-options';
export { fireworks, createFireworks } from './fireworks-provider';
export type {
  FireworksProvider,
  FireworksProviderSettings,
  FireworksErrorData,
} from './fireworks-provider';
export { VERSION } from './version';
