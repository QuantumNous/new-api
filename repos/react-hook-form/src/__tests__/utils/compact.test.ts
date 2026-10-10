import filterOutFalsy from '../../utils/compact';

describe('filterOutFalsy', () => {
  it('should return filtered array when array value is falsy ', () => {
    expect(filterOutFalsy([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
    expect(filterOutFalsy([1, 2, false, 4])).toEqual([1, 2, 4]);
    expect(filterOutFalsy([1, 2, '', 4])).toEqual([1, 2, 4]);
    expect(filterOutFalsy([1, 2, undefined, 4])).toEqual([1, 2, 4]);
    expect(filterOutFalsy([0, 1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });
});
