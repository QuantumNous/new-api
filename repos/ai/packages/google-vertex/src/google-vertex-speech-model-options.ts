import type { GoogleSpeechModelOptions } from '@ai-sdk/google';

// https://docs.cloud.google.com/text-to-speech/docs/gemini-tts
export type GoogleVertexSpeechModelId =
  | 'gemini-2.5-flash-tts'
  | 'gemini-2.5-pro-tts'
  | 'gemini-2.5-flash-lite-preview-tts'
  | 'gemini-3.1-flash-tts-preview'
  | (string & {});

export type GoogleVertexSpeechModelOptions = GoogleSpeechModelOptions;
