import { InvalidArgumentError } from '../error/invalid-argument-error';
import { prepareLanguageModelCallOptions } from './prepare-language-model-call-options';
import {
  getToolTimeoutMs,
  getTotalTimeoutMs,
  getStepTimeoutMs,
  getChunkTimeoutMs,
} from './request-options';
import { describe, it, expect } from 'vitest';

describe('prepareLanguageModelCallOptions', () => {
  describe('valid inputs', () => {
    it('should not throw an error for valid settings', () => {
      const validSettings = {
        maxOutputTokens: 100,
        temperature: 0.7,
        topP: 0.9,
        topK: 50,
        presencePenalty: 0.5,
        frequencyPenalty: 0.3,
        seed: 42,
      };

      expect(() =>
        prepareLanguageModelCallOptions(validSettings),
      ).not.toThrow();
    });

    it('should allow undefined values for optional settings', () => {
      const validSettings = {
        maxOutputTokens: undefined,
        temperature: undefined,
        topP: undefined,
        topK: undefined,
        presencePenalty: undefined,
        frequencyPenalty: undefined,
        seed: undefined,
      };

      expect(() =>
        prepareLanguageModelCallOptions(validSettings),
      ).not.toThrow();
    });
  });

  describe('invalid inputs', () => {
    describe('maxOutputTokens', () => {
      it('should throw InvalidArgumentError if maxOutputTokens is not an integer', () => {
        expect(() =>
          prepareLanguageModelCallOptions({ maxOutputTokens: 10.5 }),
        ).toThrow(
          new InvalidArgumentError({
            parameter: 'maxOutputTokens',
            value: 10.5,
            message: 'maxOutputTokens must be an integer',
          }),
        );
      });

      it('should throw InvalidArgumentError if maxOutputTokens is less than 1', () => {
        expect(() =>
          prepareLanguageModelCallOptions({ maxOutputTokens: 0 }),
        ).toThrow(
          new InvalidArgumentError({
            parameter: 'maxOutputTokens',
            value: 0,
            message: 'maxOutputTokens must be >= 1',
          }),
        );
      });
    });

    describe('temperature', () => {
      it('should throw InvalidArgumentError if temperature is not a number', () => {
        expect(() =>
          prepareLanguageModelCallOptions({ temperature: 'invalid' as any }),
        ).toThrow(
          new InvalidArgumentError({
            parameter: 'temperature',
            value: 'invalid',
            message: 'temperature must be a number',
          }),
        );
      });
    });

    describe('topP', () => {
      it('should throw InvalidArgumentError if topP is not a number', () => {
        expect(() =>
          prepareLanguageModelCallOptions({ topP: 'invalid' as any }),
        ).toThrow(
          new InvalidArgumentError({
            parameter: 'topP',
            value: 'invalid',
            message: 'topP must be a number',
          }),
        );
      });
    });

    describe('topK', () => {
      it('should throw InvalidArgumentError if topK is not a number', () => {
        expect(() =>
          prepareLanguageModelCallOptions({ topK: 'invalid' as any }),
        ).toThrow(
          new InvalidArgumentError({
            parameter: 'topK',
            value: 'invalid',
            message: 'topK must be a number',
          }),
        );
      });
    });

    describe('presencePenalty', () => {
      it('should throw InvalidArgumentError if presencePenalty is not a number', () => {
        expect(() =>
          prepareLanguageModelCallOptions({
            presencePenalty: 'invalid' as any,
          }),
        ).toThrow(
          new InvalidArgumentError({
            parameter: 'presencePenalty',
            value: 'invalid',
            message: 'presencePenalty must be a number',
          }),
        );
      });
    });

    describe('frequencyPenalty', () => {
      it('should throw InvalidArgumentError if frequencyPenalty is not a number', () => {
        expect(() =>
          prepareLanguageModelCallOptions({
            frequencyPenalty: 'invalid' as any,
          }),
        ).toThrow(
          new InvalidArgumentError({
            parameter: 'frequencyPenalty',
            value: 'invalid',
            message: 'frequencyPenalty must be a number',
          }),
        );
      });
    });

    describe('seed', () => {
      it('should throw InvalidArgumentError if seed is not an integer', () => {
        expect(() => prepareLanguageModelCallOptions({ seed: 10.5 })).toThrow(
          new InvalidArgumentError({
            parameter: 'seed',
            value: 10.5,
            message: 'seed must be an integer',
          }),
        );
      });
    });
  });

  describe('reasoning', () => {
    it('should pass through valid reasoning values', () => {
      for (const value of [
        'none',
        'minimal',
        'low',
        'medium',
        'high',
        'xhigh',
      ] as const) {
        const options = prepareLanguageModelCallOptions({ reasoning: value });
        expect(options.reasoning).toBe(value);
      }
    });

    it('should pass through provider-default', () => {
      const options = prepareLanguageModelCallOptions({
        reasoning: 'provider-default',
      });
      expect(options.reasoning).toBe('provider-default');
    });

    it('should pass through undefined', () => {
      const options = prepareLanguageModelCallOptions({});
      expect(options.reasoning).toBeUndefined();
    });
  });

  it('should return a new object with limited values', () => {
    const options = prepareLanguageModelCallOptions({
      maxOutputTokens: 100,
      temperature: 0.7,
      random: 'invalid',
    } as any);

    expect(options).toMatchInlineSnapshot(`
      {
        "frequencyPenalty": undefined,
        "maxOutputTokens": 100,
        "presencePenalty": undefined,
        "reasoning": undefined,
        "seed": undefined,
        "stopSequences": undefined,
        "temperature": 0.7,
        "topK": undefined,
        "topP": undefined,
      }
    `);
  });
});

describe('timeout helpers (from request-options)', () => {
  describe('getToolTimeoutMs', () => {
    it('should return undefined when timeout is undefined', () => {
      expect(getToolTimeoutMs(undefined, 'testTool')).toBeUndefined();
    });

    it('should return undefined when timeout is a number', () => {
      expect(getToolTimeoutMs(5000, 'testTool')).toBeUndefined();
    });

    it('should return undefined when toolMs is not set', () => {
      expect(getToolTimeoutMs({ totalMs: 10000 }, 'testTool')).toBeUndefined();
    });

    it('should return toolMs when set', () => {
      expect(getToolTimeoutMs({ toolMs: 3000 }, 'testTool')).toBe(3000);
    });

    it('should return toolMs alongside other timeout values', () => {
      expect(
        getToolTimeoutMs(
          { totalMs: 30000, stepMs: 10000, toolMs: 5000 },
          'testTool',
        ),
      ).toBe(5000);
    });
  });

  describe('getTotalTimeoutMs', () => {
    it('should return undefined when timeout is undefined', () => {
      expect(getTotalTimeoutMs(undefined)).toBeUndefined();
    });

    it('should return the number directly when timeout is a number', () => {
      expect(getTotalTimeoutMs(5000)).toBe(5000);
    });

    it('should return totalMs from an object', () => {
      expect(getTotalTimeoutMs({ totalMs: 10000 })).toBe(10000);
    });

    it('should return undefined when totalMs is not set', () => {
      expect(getTotalTimeoutMs({ stepMs: 5000 })).toBeUndefined();
    });
  });

  describe('getStepTimeoutMs', () => {
    it('should return undefined when timeout is undefined', () => {
      expect(getStepTimeoutMs(undefined)).toBeUndefined();
    });

    it('should return undefined when timeout is a number', () => {
      expect(getStepTimeoutMs(5000)).toBeUndefined();
    });

    it('should return stepMs from an object', () => {
      expect(getStepTimeoutMs({ stepMs: 3000 })).toBe(3000);
    });
  });

  describe('getChunkTimeoutMs', () => {
    it('should return undefined when timeout is undefined', () => {
      expect(getChunkTimeoutMs(undefined)).toBeUndefined();
    });

    it('should return undefined when timeout is a number', () => {
      expect(getChunkTimeoutMs(5000)).toBeUndefined();
    });

    it('should return chunkMs from an object', () => {
      expect(getChunkTimeoutMs({ chunkMs: 2000 })).toBe(2000);
    });
  });
});
