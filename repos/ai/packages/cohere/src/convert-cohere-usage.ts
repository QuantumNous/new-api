import type { LanguageModelV4Usage } from '@ai-sdk/provider';

export type CohereUsageTokens = {
  input_tokens: number;
  output_tokens: number;
};

export function convertCohereUsage(
  tokens: CohereUsageTokens | undefined | null,
): LanguageModelV4Usage {
  if (tokens == null) {
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

  const inputTokens = tokens.input_tokens;
  const outputTokens = tokens.output_tokens;

  return {
    inputTokens: {
      total: inputTokens,
      noCache: inputTokens,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: outputTokens,
      text: outputTokens,
      reasoning: undefined,
    },
    raw: tokens,
  };
}
