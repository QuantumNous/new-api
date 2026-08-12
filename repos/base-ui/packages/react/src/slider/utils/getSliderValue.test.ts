import { describe, expect, it } from 'vitest';
import { getSliderValue } from './getSliderValue';

describe('getSliderValue', () => {
  it('clamps a single value to the min/max range', () => {
    expect(getSliderValue(150, 0, 0, 100, false, [50])).toBe(100);
    expect(getSliderValue(-10, 0, 0, 100, false, [50])).toBe(0);
  });

  describe('range neighbours', () => {
    it('does not let a thumb cross a neighbour whose value is 0', () => {
      expect(getSliderValue(5, 0, -10, 10, true, [-10, 0])).toEqual([0, 0]);
      expect(getSliderValue(-5, 1, -10, 10, true, [0, 10])).toEqual([0, 0]);
    });

    it('bounds a thumb between its real neighbours', () => {
      expect(getSliderValue(50, 1, 0, 100, true, [20, 40, 80])).toEqual([20, 50, 80]);
      expect(getSliderValue(90, 1, 0, 100, true, [20, 40, 80])).toEqual([20, 80, 80]);
      expect(getSliderValue(10, 1, 0, 100, true, [20, 40, 80])).toEqual([20, 20, 80]);
    });

    it('leaves the outer edges unbounded by missing neighbours', () => {
      expect(getSliderValue(-30, 0, -50, 50, true, [-20, 0])).toEqual([-30, 0]);
      expect(getSliderValue(40, 1, -50, 50, true, [-20, 0])).toEqual([-20, 40]);
    });
  });
});
