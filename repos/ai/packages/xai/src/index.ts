export type {
  XaiLanguageModelChatOptions,
  /** @deprecated Use `XaiLanguageModelChatOptions` instead. */
  XaiLanguageModelChatOptions as XaiProviderOptions,
} from './xai-chat-language-model-options';
export type { XaiErrorData } from './xai-error';
export type { XaiFilePartProviderOptions } from './xai-file-part-options';
export type {
  XaiLanguageModelResponsesOptions,
  /** @deprecated Use `XaiLanguageModelResponsesOptions` instead. */
  XaiLanguageModelResponsesOptions as XaiResponsesProviderOptions,
} from './responses/xai-responses-language-model-options';
export type {
  XaiImageModelOptions,
  /** @deprecated Use `XaiImageModelOptions` instead. */
  XaiImageModelOptions as XaiImageProviderOptions,
} from './xai-image-model-options';
export type { XaiVideoModelId } from './xai-video-settings';
export type {
  XaiVideoModelOptions,
  /** @deprecated Use `XaiVideoModelOptions` instead. */
  XaiVideoModelOptions as XaiVideoProviderOptions,
} from './xai-video-model-options';
export type { XaiSpeechModelOptions } from './xai-speech-model-options';
export type { XaiTranscriptionModelOptions } from './xai-transcription-model-options';
export type { XaiFilesOptions } from './files/xai-files-options';
export { createXai, xai } from './xai-provider';
export type { XaiProvider, XaiProviderSettings } from './xai-provider';
export { XaiRealtimeModel as Experimental_XaiRealtimeModel } from './realtime/xai-realtime-model';
export type { XaiRealtimeModelConfig as Experimental_XaiRealtimeModelConfig } from './realtime/xai-realtime-model';
export {
  codeExecution,
  mcpServer,
  viewImage,
  viewXVideo,
  webSearch,
  xSearch,
  xaiTools,
} from './tool';
export { VERSION } from './version';
