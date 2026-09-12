import { describe, expect, it } from 'vitest';

import { filterNullable } from './filter-nullable';

describe('filterNullable', () => {
  it('removes null and undefined values from a value list', () => {
    expect(filterNullable(1, null, 2, undefined, 3)).toEqual([1, 2, 3]);
  });

  it('preserves other falsy values', () => {
    expect(
      filterNullable<number | boolean | string>(0, false, '', null, undefined),
    ).toEqual([0, false, '']);
  });
});
