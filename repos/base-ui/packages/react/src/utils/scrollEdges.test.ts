import { describe, expect, it } from 'vitest';
import { normalizeScrollOffset, SCROLL_EDGE_TOLERANCE_PX } from './scrollEdges';

describe('normalizeScrollOffset', () => {
  it('returns 0 when max is non-positive', () => {
    expect(normalizeScrollOffset(10, 0)).toBe(0);
    expect(normalizeScrollOffset(10, -5)).toBe(0);
  });

  it('snaps to the start edge within the tolerance', () => {
    expect(normalizeScrollOffset(0.5, 10)).toBe(0);
  });

  it('snaps to the end edge within the tolerance', () => {
    expect(normalizeScrollOffset(9.5, 10)).toBe(10);
  });

  it('keeps values away from edges unchanged', () => {
    expect(normalizeScrollOffset(5, 10)).toBe(5);
  });

  it('chooses the closest edge when tolerances overlap', () => {
    const max = SCROLL_EDGE_TOLERANCE_PX;

    expect(normalizeScrollOffset(0, max)).toBe(0);
    expect(normalizeScrollOffset(max, max)).toBe(max);
    expect(normalizeScrollOffset(max * 0.4, max)).toBe(0);
    expect(normalizeScrollOffset(max * 0.6, max)).toBe(max);
  });
});
