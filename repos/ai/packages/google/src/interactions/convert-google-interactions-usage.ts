import type { JSONObject, LanguageModelV4Usage } from '@ai-sdk/provider';
import type { GoogleInteractionsUsage } from './google-interactions-api';

export function convertGoogleInteractionsUsage(
  usage: GoogleInteractionsUsage | undefined | null,
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

  const totalInput = usage.total_input_tokens ?? 0;
  const totalOutput = usage.total_output_tokens ?? 0;
  const totalThought = usage.total_thought_tokens ?? 0;
  const totalCached = usage.total_cached_tokens ?? 0;

  return {
    inputTokens: {
      total: usage.total_input_tokens ?? undefined,
      noCache:
        usage.total_input_tokens == null ? undefined : totalInput - totalCached,
      cacheRead: usage.total_cached_tokens ?? undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total:
        usage.total_output_tokens == null && usage.total_thought_tokens == null
          ? undefined
          : totalOutput + totalThought,
      text: usage.total_output_tokens ?? undefined,
      reasoning: usage.total_thought_tokens ?? undefined,
    },
    raw: usage as unknown as JSONObject,
  };
}

/**
 * Extracts the per-modality output token breakdown from an Interactions usage
 * record (e.g. `{ video: 57920, text: 12 }`).
 */
export function getGoogleInteractionsOutputTokensByModality(
  usage: GoogleInteractionsUsage | undefined | null,
): Record<string, number> | undefined {
  const byModality = usage?.output_tokens_by_modality;
  if (byModality == null) {
    return undefined;
  }

  const result: Record<string, number> = {};
  for (const entry of byModality) {
    if (entry?.modality != null && entry.tokens != null) {
      result[entry.modality] = entry.tokens;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
