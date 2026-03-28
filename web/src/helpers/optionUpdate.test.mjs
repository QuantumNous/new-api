import { describe, expect, test } from 'bun:test';

import {
  ensureOptionUpdateSucceeded,
  getOptionUpdateErrorMessage,
} from './optionUpdate.js';

describe('ensureOptionUpdateSucceeded', () => {
  test('throws the backend message when the option update response is unsuccessful', () => {
    expect(() =>
      ensureOptionUpdateSucceeded({
        success: false,
        message: 'Route Manager URL is invalid',
      }),
    ).toThrow('Route Manager URL is invalid');
  });

  test('throws the fallback message when the backend message is empty', () => {
    expect(() =>
      ensureOptionUpdateSucceeded(
        {
          success: false,
          message: '',
        },
        'Option update failed',
      ),
    ).toThrow('Option update failed');
  });

  test('returns without throwing when the option update succeeds', () => {
    expect(() =>
      ensureOptionUpdateSucceeded({
        success: true,
        message: 'ok',
      }),
    ).not.toThrow();
  });
});

describe('getOptionUpdateErrorMessage', () => {
  test('prefers the thrown error message when available', () => {
    expect(
      getOptionUpdateErrorMessage(
        new Error('Route Manager URL is invalid'),
        'Option update failed',
      ),
    ).toBe('Route Manager URL is invalid');
  });

  test('falls back to the provided message when the error has no message', () => {
    expect(
      getOptionUpdateErrorMessage(
        {
          message: '',
        },
        'Option update failed',
      ),
    ).toBe('Option update failed');
  });
});
