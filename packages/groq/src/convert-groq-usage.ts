import type { LanguageModelV4Usage } from '@ai-sdk/provider';

export function convertGroqUsage(
  usage:
    | {
        prompt_tokens?: number | null | undefined;
        completion_tokens?: number | null | undefined;
        prompt_tokens_details?:
          | {
              cached_tokens?: number | null | undefined;
            }
          | null
          | undefined;
        completion_tokens_details?:
          | {
              reasoning_tokens?: number | null | undefined;
            }
          | null
          | undefined;
      }
    | undefined
    | null,
): LanguageModelV4Usage {
  if (usage == null) {
    return {
      inputTokens: {
        total: undefined,
        noCache: undefined,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: undefined,
        text: undefined,
        reasoning: undefined,
      },
      raw: undefined,
    };
  }

  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  const reasoningTokens =
    usage.completion_tokens_details?.reasoning_tokens ?? undefined;
  const textTokens =
    reasoningTokens != null
      ? completionTokens - reasoningTokens
      : completionTokens;

  return {
    inputTokens: {
      total: promptTokens,
      noCache: promptTokens,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: completionTokens,
      text: textTokens,
      reasoning: reasoningTokens,
    },
    raw: usage,
  };
}
