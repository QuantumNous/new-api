import { describe, expect, it } from 'vitest';
import { calculateTokensPerSecond } from './calculate-tokens-per-second';

describe('calculateTokensPerSecond', () => {
  it('should calculate average output tokens per second', () => {
    expect(
      calculateTokensPerSecond({
        tokens: 10,
        durationMs: 500,
      }),
    ).toBe(20);
  });

  it('should return 0 when output token count is unknown', () => {
    expect(
      calculateTokensPerSecond({
        tokens: undefined,
        durationMs: 500,
      }),
    ).toBe(0);
  });

  it('should return 0 when response time is 0', () => {
    expect(
      calculateTokensPerSecond({
        tokens: 10,
        durationMs: 0,
      }),
    ).toBe(0);
  });

  it('should return 0 when response time is 0 and output tokens are unknown', () => {
    expect(
      calculateTokensPerSecond({
        tokens: undefined,
        durationMs: 0,
      }),
    ).toBe(0);
  });

  it('should return 0 when computed tokens per second is not JSON-serializable', () => {
    expect(
      calculateTokensPerSecond({
        tokens: Number.POSITIVE_INFINITY,
        durationMs: 500,
      }),
    ).toBe(0);

    expect(
      calculateTokensPerSecond({
        tokens: Number.NaN,
        durationMs: 500,
      }),
    ).toBe(0);
  });

  it('should return 0 when duration is unknown', () => {
    expect(
      calculateTokensPerSecond({
        tokens: 10,
        durationMs: undefined,
      }),
    ).toBe(0);
  });
});
