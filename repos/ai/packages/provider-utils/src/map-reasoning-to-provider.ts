import type {
  LanguageModelV4CallOptions,
  SharedV4Warning,
} from '@ai-sdk/provider';

export type ReasoningLevel = Exclude<
  LanguageModelV4CallOptions['reasoning'],
  'none' | 'provider-default' | undefined
>;

export function isCustomReasoning(
  reasoning: LanguageModelV4CallOptions['reasoning'],
): reasoning is Exclude<
  LanguageModelV4CallOptions['reasoning'],
  'provider-default' | undefined
> {
  return reasoning !== undefined && reasoning !== 'provider-default';
}

/**
 * Maps a top-level reasoning level to a provider-specific effort string using
 * the given effort map. Pushes a compatibility warning if the reasoning level
 * maps to a different string, or an unsupported warning if the level is not
 * present in the map.
 *
 * @returns The mapped effort string, or `undefined` if the level is not
 *   supported.
 */
export function mapReasoningToProviderEffort<T extends string>({
  reasoning,
  effortMap,
  warnings,
}: {
  reasoning: ReasoningLevel;
  effortMap: Partial<Record<ReasoningLevel, T>>;
  warnings: SharedV4Warning[];
}): T | undefined {
  const mapped = effortMap[reasoning];

  if (mapped == null) {
    warnings.push({
      type: 'unsupported',
      feature: 'reasoning',
      details: `reasoning "${reasoning}" is not supported by this model.`,
    });
    return undefined;
  }

  if (mapped !== reasoning) {
    warnings.push({
      type: 'compatibility',
      feature: 'reasoning',
      details: `reasoning "${reasoning}" is not directly supported by this model. mapped to effort "${mapped}".`,
    });
  }

  return mapped;
}

const DEFAULT_REASONING_BUDGET_PERCENTAGES: Record<ReasoningLevel, number> = {
  minimal: 0.02,
  low: 0.1,
  medium: 0.3,
  high: 0.6,
  xhigh: 0.9,
};

/**
 * Maps a top-level reasoning level to an absolute token budget by multiplying
 * the model's max output tokens by a percentage from the budget percentages
 * map. The result is clamped between `minReasoningBudget` (default 1024) and
 * `maxReasoningBudget`. Pushes an unsupported warning if the level is not
 * present in the budget percentages map.
 *
 * @returns The computed token budget, or `undefined` if the level is not
 *   supported.
 */
export function mapReasoningToProviderBudget({
  reasoning,
  maxOutputTokens,
  maxReasoningBudget,
  minReasoningBudget = 1024,
  budgetPercentages = DEFAULT_REASONING_BUDGET_PERCENTAGES,
  warnings,
}: {
  reasoning: ReasoningLevel;
  maxOutputTokens: number;
  maxReasoningBudget: number;
  minReasoningBudget?: number;
  budgetPercentages?: Partial<Record<ReasoningLevel, number>>;
  warnings: SharedV4Warning[];
}): number | undefined {
  const pct = budgetPercentages[reasoning];

  if (pct == null) {
    warnings.push({
      type: 'unsupported',
      feature: 'reasoning',
      details: `reasoning "${reasoning}" is not supported by this model.`,
    });
    return undefined;
  }

  return Math.min(
    maxReasoningBudget,
    Math.max(minReasoningBudget, Math.round(maxOutputTokens * pct)),
  );
}
