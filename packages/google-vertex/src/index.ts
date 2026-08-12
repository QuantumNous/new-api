export type { GoogleVertexEmbeddingModelOptions } from './google-vertex-embedding-model-options';
export type {
  GoogleVertexTranscriptionModelId,
  GoogleVertexTranscriptionModelOptions,
} from './google-vertex-transcription-model-options';
export type {
  GoogleVertexImageModelOptions,
  /** @deprecated Use `GoogleVertexImageModelOptions` instead. */
  GoogleVertexImageModelOptions as GoogleVertexImageProviderOptions,
} from './google-vertex-image-model-options';
export type {
  GoogleVertexVideoModelOptions,
  /** @deprecated Use `GoogleVertexVideoModelOptions` instead. */
  GoogleVertexVideoModelOptions as GoogleVertexVideoProviderOptions,
} from './google-vertex-video-model-options';
export type { GoogleVertexVideoModelId } from './google-vertex-video-settings';
export type {
  GoogleVertexSpeechModelId,
  GoogleVertexSpeechModelOptions,
} from './google-vertex-speech-model-options';
export {
  createGoogleVertex,
  /** @deprecated Use `createGoogleVertex` instead. */
  createGoogleVertex as createVertex,
  googleVertex,
  /** @deprecated Use `googleVertex` instead. */
  googleVertex as vertex,
} from './google-vertex-provider';
export type {
  GoogleVertexProvider,
  GoogleVertexProviderSettings,
} from './google-vertex-provider';
export { VERSION } from './version';
