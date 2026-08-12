import { InvalidArgumentError } from '@ai-sdk/provider';
import { describe, expect, it } from 'vitest';
import { validateBaseURL } from './validate-base-url';

describe('validateBaseURL', () => {
  it('returns a valid baseURL', () => {
    expect(validateBaseURL('https://example.com/')).toBe(
      'https://example.com/',
    );
  });

  it('returns undefined when the baseURL is undefined', () => {
    expect(validateBaseURL(undefined)).toBeUndefined();
  });

  it.each(['', '   '])(
    'throws an InvalidArgumentError for an empty baseURL',
    baseURL => {
      expect(() => validateBaseURL(baseURL)).toThrow(
        expect.objectContaining({
          name: 'AI_InvalidArgumentError',
          argument: 'baseURL',
          message: 'baseURL must be a non-empty string.',
        }),
      );

      try {
        validateBaseURL(baseURL);
      } catch (error) {
        expect(InvalidArgumentError.isInstance(error)).toBe(true);
      }
    },
  );
});
