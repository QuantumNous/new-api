import { InvalidArgumentError } from '../src/error/invalid-argument-error';
import { prepareCallSettings, prepareLanguageModelCallOptions } from './index';
import { describe, it, expect } from 'vitest';

describe('prepareCallSettings (deprecated alias)', () => {
  it('should behave identically to prepareLanguageModelCallOptions', () => {
    const input = { maxOutputTokens: 100, temperature: 0.7 };
    expect(prepareCallSettings(input)).toEqual(
      prepareLanguageModelCallOptions(input),
    );
  });

  it('should throw the same errors as prepareLanguageModelCallOptions', () => {
    expect(() => prepareCallSettings({ maxOutputTokens: 10.5 })).toThrow(
      new InvalidArgumentError({
        parameter: 'maxOutputTokens',
        value: 10.5,
        message: 'maxOutputTokens must be an integer',
      }),
    );
  });
});
