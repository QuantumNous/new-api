import { describe, expect, it } from 'vitest';
import { roundValueToStep } from './roundValueToStep';

describe('roundValueToStep', () => {
  it('preserves precision from the step origin', () => {
    expect(roundValueToStep(0.35, 0.1, 0.25)).toBe(0.35);
  });
});
