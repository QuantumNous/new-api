import { getPotentialStartIndex } from './get-potential-start-index';
import { describe, it, expect } from 'vitest';

describe('getPotentialStartIndex', () => {
  it('should return null when searchedText is empty', () => {
    const result = getPotentialStartIndex('1234567890', '');
    expect(result).toBeNull();
  });

  it('should return null when searchedText is not in text', () => {
    const result = getPotentialStartIndex('1234567890', 'a');
    expect(result).toBeNull();
  });

  it('should return index when searchedText is in text', () => {
    const result = getPotentialStartIndex('1234567890', '1234567890');
    expect(result).toBe(0);
  });

  it('should return index when searchedText might start in text', () => {
    const result = getPotentialStartIndex('1234567890', '0123');
    expect(result).toBe(9);
  });

  it('should return index when searchedText might start in text', () => {
    const result = getPotentialStartIndex('1234567890', '90123');
    expect(result).toBe(8);
  });

  it('should return index when searchedText might start in text', () => {
    const result = getPotentialStartIndex('1234567890', '890123');
    expect(result).toBe(7);
  });
});
