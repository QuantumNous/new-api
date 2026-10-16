import { describe, expect, it } from 'vitest';
import type { StepResult } from './step-result';
import {
  hasToolCall,
  isLoopFinished,
  isStepCount,
  isStopConditionMet,
} from './stop-condition';

function createStepResult({
  toolCalls = [],
}: {
  toolCalls?: StepResult<any, any>['toolCalls'];
} = {}): StepResult<any, any> {
  return {
    toolCalls,
  } as StepResult<any, any>;
}

describe('stop conditions', () => {
  describe('isStepCount', () => {
    it('should return true when the step count matches exactly', () => {
      const stopCondition = isStepCount(2);

      expect(
        stopCondition({
          steps: [createStepResult(), createStepResult()],
        }),
      ).toBe(true);
    });

    it('should return false when the step count does not match exactly', () => {
      const stopCondition = isStepCount(2);

      expect(stopCondition({ steps: [createStepResult()] })).toBe(false);
      expect(
        stopCondition({
          steps: [createStepResult(), createStepResult(), createStepResult()],
        }),
      ).toBe(false);
    });
  });

  describe('isLoopFinished', () => {
    it('should always return false', () => {
      const stopCondition = isLoopFinished();

      expect(stopCondition({ steps: [] })).toBe(false);
      expect(stopCondition({ steps: [createStepResult()] })).toBe(false);
    });
  });

  describe('hasToolCall', () => {
    it('should return true when the last step contains the specified tool call', () => {
      const stopCondition = hasToolCall('finalAnswer');

      expect(
        stopCondition({
          steps: [
            createStepResult(),
            createStepResult({
              toolCalls: [{ toolName: 'finalAnswer' }] as any,
            }),
          ],
        }),
      ).toBe(true);
    });

    it('should return false when the specified tool call only appears in earlier steps', () => {
      const stopCondition = hasToolCall('finalAnswer');

      expect(
        stopCondition({
          steps: [
            createStepResult({
              toolCalls: [{ toolName: 'finalAnswer' }] as any,
            }),
            createStepResult(),
          ],
        }),
      ).toBe(false);
    });

    it('should return true when the last step contains any tool call from the provided tool names', () => {
      const toolNames = ['search', 'finalAnswer'] as const;
      const stopCondition = hasToolCall(...toolNames);

      expect(
        stopCondition({
          steps: [
            createStepResult(),
            createStepResult({
              toolCalls: [{ toolName: 'finalAnswer' }] as any,
            }),
          ],
        }),
      ).toBe(true);
    });

    it('should return false when the last step does not contain any tool call from the provided tool names', () => {
      const toolNames = ['search', 'finalAnswer'] as const;
      const stopCondition = hasToolCall(...toolNames);

      expect(
        stopCondition({
          steps: [
            createStepResult(),
            createStepResult({
              toolCalls: [{ toolName: 'weather' }] as any,
            }),
          ],
        }),
      ).toBe(false);
    });

    it('should return false when there are no steps', () => {
      const stopCondition = hasToolCall('finalAnswer');

      expect(stopCondition({ steps: [] })).toBe(false);
    });
  });

  describe('isStopConditionMet', () => {
    it('should return true when any stop condition returns true', async () => {
      await expect(
        isStopConditionMet({
          stopConditions: [() => false, () => true, () => false],
          steps: [createStepResult()],
        }),
      ).resolves.toBe(true);
    });

    it('should return false when all stop conditions return false', async () => {
      await expect(
        isStopConditionMet({
          stopConditions: [() => false, () => false],
          steps: [createStepResult()],
        }),
      ).resolves.toBe(false);
    });

    it('should support asynchronous stop conditions', async () => {
      await expect(
        isStopConditionMet({
          stopConditions: [
            async () => false,
            async ({ steps }) => steps.length === 2,
          ],
          steps: [createStepResult(), createStepResult()],
        }),
      ).resolves.toBe(true);
    });

    it('should reject when a stop condition rejects', async () => {
      await expect(
        isStopConditionMet({
          stopConditions: [
            () => false,
            async () => {
              throw new Error('stop condition failed');
            },
          ],
          steps: [createStepResult()],
        }),
      ).rejects.toThrow('stop condition failed');
    });
  });
});
