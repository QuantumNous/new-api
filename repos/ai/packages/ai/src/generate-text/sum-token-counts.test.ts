import { describe, expect, it } from 'vitest';
import { sumTokenCounts } from './sum-token-counts';

describe('sumTokenCounts', () => {
  it('should sum known token counts', () => {
    expect(sumTokenCounts(3, 10)).toBe(13);
  });

  it('should treat one unknown token count as 0', () => {
    expect(sumTokenCounts(undefined, 10)).toBe(10);
    expect(sumTokenCounts(3, undefined)).toBe(3);
  });

  it('should return undefined when both token counts are unknown', () => {
    expect(sumTokenCounts(undefined, undefined)).toBeUndefined();
  });
});
