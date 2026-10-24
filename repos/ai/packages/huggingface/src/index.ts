export {
  createHuggingFace,
  huggingFace,
  /** @deprecated Use `huggingFace` instead. */
  huggingFace as huggingface,
} from './huggingface-provider';
export type {
  HuggingFaceProvider,
  HuggingFaceProviderSettings,
} from './huggingface-provider';
export type {
  HuggingFaceResponsesModelId,
  HuggingFaceResponsesSettings,
} from './responses/huggingface-responses-settings';
export type { OpenAICompatibleErrorData as HuggingFaceErrorData } from '@ai-sdk/openai-compatible';
export { VERSION } from './version';
