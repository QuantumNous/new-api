import { describe, expect, it } from 'vitest';
import { supportsReasoningEffort } from './supports-reasoning-effort';

describe('supportsReasoningEffort', () => {
  it.each([
    'grok-4.3',
    'grok-latest',
    'grok-4.20-multi-agent',
    'grok-4.20-multi-agent-0309',
    'grok-3-mini',
  ])('should return true for %s', modelId => {
    expect(supportsReasoningEffort(modelId)).toBe(true);
  });

  it.each([
    'grok-4.20-reasoning',
    'grok-4.20-non-reasoning',
    'grok-4.20-0309-reasoning',
    'grok-4.20-0309-non-reasoning',
  ])('should return false for %s', modelId => {
    expect(supportsReasoningEffort(modelId)).toBe(false);
  });
});
