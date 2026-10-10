/**
 * The grok-4.20 reasoning and non-reasoning models (including dated variants
 * such as `grok-4.20-0309-reasoning`) reject the reasoning effort parameter
 * with an invalid-argument error for every value, including `none`.
 * Other models such as `grok-4.3`, `grok-latest`, and
 * `grok-4.20-multi-agent` accept it.
 */
const modelsWithoutReasoningEffort = /^grok-4\.20(-\d{4})?-(non-)?reasoning$/;

export function supportsReasoningEffort(modelId: string): boolean {
  return !modelsWithoutReasoningEffort.test(modelId);
}
