import type { LanguageModelCallOptions } from './language-model-call-options';
import type { RequestOptions } from './request-options';

export type { LanguageModelCallOptions } from './language-model-call-options';
export type { RequestOptions, TimeoutConfiguration } from './request-options';

/** @deprecated Use `LanguageModelCallOptions` combined with `RequestOptions` instead. */
export type CallSettings = LanguageModelCallOptions &
  Omit<RequestOptions, 'timeout'>;
export {
  getTotalTimeoutMs,
  getStepTimeoutMs,
  getChunkTimeoutMs,
  getToolTimeoutMs,
} from './request-options';
export {
  assistantModelMessageSchema,
  modelMessageSchema,
  systemModelMessageSchema,
  toolModelMessageSchema,
  userModelMessageSchema,
} from './message';
export type { Instructions, Prompt } from './prompt';
export { convertDataContentToBase64String } from './data-content';

// re-export types from provider-utils
export type {
  AssistantContent,
  AssistantModelMessage,
  DataContent,
  FilePart,
  ImagePart,
  ModelMessage,
  SystemModelMessage,
  TextPart,
  ToolCallPart,
  ToolContent,
  ToolModelMessage,
  ToolResultPart,
  UserContent,
  UserModelMessage,
} from '@ai-sdk/provider-utils';
