export { createDeepgram, deepgram } from './deepgram-provider';
export type {
  DeepgramProvider,
  DeepgramProviderSettings,
} from './deepgram-provider';
export { DeepgramSpeechModel } from './deepgram-speech-model';
export type {
  DeepgramSpeechModelOptions,
  /** @deprecated Use `DeepgramSpeechModelOptions` instead. */
  DeepgramSpeechModelOptions as DeepgramSpeechCallOptions,
} from './deepgram-speech-model-options';
export type { DeepgramSpeechModelId } from './deepgram-speech-options';
export type { DeepgramTranscriptionModelOptions } from './deepgram-transcription-model-options';
export { VERSION } from './version';
