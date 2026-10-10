import type { GroqChatModelId } from './groq-chat-language-model-options';

/**
 * Models that support browser search functionality.
 * Based on: https://console.groq.com/docs/browser-search
 */
export const BROWSER_SEARCH_SUPPORTED_MODELS: readonly GroqChatModelId[] = [
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
] as const;

/**
 * Check if a model supports browser search functionality.
 */
export function isBrowserSearchSupportedModel(
  modelId: GroqChatModelId,
): boolean {
  return BROWSER_SEARCH_SUPPORTED_MODELS.includes(modelId);
}

/**
 * Get a formatted list of supported models for error messages.
 */
export function getSupportedModelsString(): string {
  return BROWSER_SEARCH_SUPPORTED_MODELS.join(', ');
}
