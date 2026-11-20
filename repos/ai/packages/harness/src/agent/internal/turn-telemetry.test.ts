import type { Telemetry } from 'ai';
import { describe, expect, test } from 'vitest';
import { createTurnTelemetry } from './turn-telemetry';

const usage = {
  inputTokens: {
    total: 1,
    noCache: 1,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

describe('createTurnTelemetry', () => {
  test('includes the current stepNumber on onStepEnd events', () => {
    const stepStartNumbers: number[] = [];
    const stepEndNumbers: number[] = [];
    const integration = {
      onStepStart: event => {
        stepStartNumbers.push(event.stepNumber);
      },
      onStepEnd: event => {
        stepEndNumbers.push(event.stepNumber);
      },
    } satisfies Telemetry;

    const telemetry = createTurnTelemetry({
      telemetry: { integrations: [integration] },
      harnessId: 'mock',
      modelId: 'mock-model',
      instructions: undefined,
      promptText: 'go',
      runtimeContext: undefined,
    });

    telemetry.start();
    telemetry.ensureStepOpen();
    telemetry.stepFinish({
      finishReason: { unified: 'stop', raw: 'stop' },
      usage,
      content: [{ type: 'text', text: 'done' }],
    });

    telemetry.ensureStepOpen();
    telemetry.end({
      finishReason: { unified: 'stop', raw: 'stop' },
      usage,
    });

    expect(stepStartNumbers).toEqual([0, 1]);
    expect(stepEndNumbers).toEqual([0, 1]);
  });
});
