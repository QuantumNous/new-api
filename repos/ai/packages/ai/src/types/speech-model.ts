import type {
  SpeechModelV2,
  SpeechModelV3,
  SpeechModelV4,
} from '@ai-sdk/provider';

/**
 * Speech model that is used by the AI SDK.
 */
export type SpeechModel =
  | string
  | SpeechModelV4
  | SpeechModelV3
  | SpeechModelV2;
