import type { HarnessV1StreamPart } from '@ai-sdk/harness';
import { mapUsage } from './opencode-usage';

type FinishStepEvent = Extract<HarnessV1StreamPart, { type: 'finish-step' }>;

export function mapOpenCodeFinishReason(
  reason: string,
): 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' {
  const normalized = reason.toLowerCase();
  if (normalized.includes('length')) return 'length';
  if (normalized.includes('filter')) return 'content-filter';
  if (normalized.includes('tool')) return 'tool-calls';
  if (normalized.includes('error') || normalized.includes('fail'))
    return 'error';
  if (normalized === 'stop' || normalized === 'end') return 'stop';
  return 'other';
}

export function legacyStepFinishPartToFinishStep(
  part: unknown,
): FinishStepEvent | undefined {
  if (!isRecord(part) || part.type !== 'step-finish') return undefined;
  const rawFinish = typeof part.reason === 'string' ? part.reason : 'stop';
  return {
    type: 'finish-step',
    finishReason: {
      unified: mapOpenCodeFinishReason(rawFinish),
      raw: rawFinish,
    },
    usage: mapUsage(part.tokens),
    ...(typeof part.cost === 'number'
      ? { harnessMetadata: { opencode: { cost: part.cost } } }
      : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
