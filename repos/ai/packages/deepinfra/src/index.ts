export {
  createDeepInfra,
  deepInfra,
  /** @deprecated Use `deepInfra` instead. */
  deepInfra as deepinfra,
} from './deepinfra-provider';
export type {
  DeepInfraProvider,
  DeepInfraProviderSettings,
} from './deepinfra-provider';
export type { OpenAICompatibleErrorData as DeepInfraErrorData } from '@ai-sdk/openai-compatible';
export { VERSION } from './version';
