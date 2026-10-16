import { describe, expect, it } from 'vitest';

import { asArray } from './as-array';

describe('asArray', () => {
  it('returns an empty array for undefined', () => {
    expect(asArray(undefined)).toEqual([]);
  });

  it('wraps a single value in an array', () => {
    expect(asArray('value')).toEqual(['value']);
  });

  it('returns an array value unchanged', () => {
    const value = ['a', 'b'];

    expect(asArray(value)).toBe(value);
  });
});
