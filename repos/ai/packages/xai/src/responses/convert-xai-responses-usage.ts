import type { LanguageModelV4Usage } from '@ai-sdk/provider';
import type { XaiResponsesUsage } from './xai-responses-api';

export function convertXaiResponsesUsage(
  usage: XaiResponsesUsage,
): LanguageModelV4Usage {
  const cacheReadTokens = usage.input_tokens_details?.cached_tokens ?? 0;
  const reasoningTokens = usage.output_tokens_details?.reasoning_tokens ?? 0;

  const inputTokensIncludesCached = cacheReadTokens <= usage.input_tokens;

  return {
    inputTokens: {
      total: inputTokensIncludesCached
        ? usage.input_tokens
        : usage.input_tokens + cacheReadTokens,
      noCache: inputTokensIncludesCached
        ? usage.input_tokens - cacheReadTokens
        : usage.input_tokens,
      cacheRead: cacheReadTokens,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: usage.output_tokens,
      text: usage.output_tokens - reasoningTokens,
      reasoning: reasoningTokens,
    },
    raw: usage,
  };
}
