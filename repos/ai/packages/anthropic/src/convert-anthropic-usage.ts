import type { JSONObject, LanguageModelV4Usage } from '@ai-sdk/provider';

/**
 * Represents a single iteration in the usage breakdown.
 *
 * - `compaction` / `message`: executor iterations, billed at executor rates.
 * - `advisor_message`: advisor sub-inference, billed at the advisor model's
 *   rates. Advisor tokens are NOT rolled into the top-level totals because
 *   they bill at a different rate; inspect this array for advisor cost
 *   tracking.
 * - `fallback_message`: a server-side fallback attempt that served the turn.
 *   When present, the top-level usage already reflects the served answer, so
 *   it is used as-is.
 *
 * The `model` field carries the model that produced the iteration. The API
 * populates it for the per-model attribution cases (the fallback chain and
 * advisor sub-inferences) and omits it otherwise.
 */
export type AnthropicUsageIteration = {
  type: 'compaction' | 'message' | 'advisor_message' | 'fallback_message';
  model?: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

export type AnthropicUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  /**
   * When compaction is triggered or the advisor tool is invoked, this
   * array contains usage for each sampling iteration. Top-level
   * input_tokens and output_tokens exclude compaction iteration usage,
   * and the advisor sub-inference is also not rolled into the top-level
   * totals because it bills at a different rate. Use this array for
   * per-iteration cost tracking.
   */
  iterations?: AnthropicUsageIteration[] | null;
};

export function convertAnthropicUsage({
  usage,
  rawUsage,
}: {
  usage: AnthropicUsage;
  rawUsage?: JSONObject;
}): LanguageModelV4Usage {
  const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;

  // When iterations is present (compaction or advisor), sum across executor
  // iterations to get the true executor totals. The top-level input_tokens
  // and output_tokens exclude compaction usage. Advisor (`advisor_message`)
  // iterations are filtered out: they bill at the advisor model's rates,
  // not the executor's, so they don't belong in the top-level totals.
  //
  // A turn served by a server-side fallback is the exception: the served
  // answer comes from the fallback model, so the executor `message` iteration
  // is the blocked primary attempt (zero output). The top-level totals already
  // reflect the fallback answer, so they are used directly.
  let inputTokens: number;
  let outputTokens: number;

  const servedByFallback = usage.iterations?.some(
    iter => iter.type === 'fallback_message',
  );

  if (usage.iterations && usage.iterations.length > 0 && !servedByFallback) {
    const executorIterations = usage.iterations.filter(
      iter => iter.type === 'compaction' || iter.type === 'message',
    );

    if (executorIterations.length > 0) {
      const totals = executorIterations.reduce(
        (acc, iter) => ({
          input: acc.input + iter.input_tokens,
          output: acc.output + iter.output_tokens,
        }),
        { input: 0, output: 0 },
      );
      inputTokens = totals.input;
      outputTokens = totals.output;
    } else {
      inputTokens = usage.input_tokens;
      outputTokens = usage.output_tokens;
    }
  } else {
    inputTokens = usage.input_tokens;
    outputTokens = usage.output_tokens;
  }

  return {
    inputTokens: {
      total: inputTokens + cacheCreationTokens + cacheReadTokens,
      noCache: inputTokens,
      cacheRead: cacheReadTokens,
      cacheWrite: cacheCreationTokens,
    },
    outputTokens: {
      total: outputTokens,
      text: undefined,
      reasoning: undefined,
    },
    raw: rawUsage ?? usage,
  };
}
