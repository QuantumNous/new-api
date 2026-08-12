import { describe, expect, it } from 'vitest';
import {
  legacyStepFinishPartToFinishStep,
  mapOpenCodeFinishReason,
} from './opencode-finish-step';

describe('OpenCode finish-step helpers', () => {
  it('maps legacy step-finish parts to finish-step events', () => {
    expect(
      legacyStepFinishPartToFinishStep({
        type: 'step-finish',
        reason: 'stop',
        cost: 0.0012,
        tokens: {
          input: 20,
          output: 10,
          reasoning: 3,
          cache: { read: 8, write: 2 },
        },
      }),
    ).toEqual({
      type: 'finish-step',
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: {
          total: 20,
          noCache: 12,
          cacheRead: 8,
          cacheWrite: 2,
        },
        outputTokens: {
          total: 13,
          text: 10,
          reasoning: 3,
        },
      },
      harnessMetadata: { opencode: { cost: 0.0012 } },
    });
  });

  it('ignores non-step-finish parts', () => {
    expect(
      legacyStepFinishPartToFinishStep({ type: 'tool', callID: 'tool-1' }),
    ).toBeUndefined();
  });

  it('normalizes OpenCode finish reasons', () => {
    expect(mapOpenCodeFinishReason('length')).toBe('length');
    expect(mapOpenCodeFinishReason('tool_call')).toBe('tool-calls');
    expect(mapOpenCodeFinishReason('error')).toBe('error');
    expect(mapOpenCodeFinishReason('unknown')).toBe('other');
  });
});
