import fillEmptyArray from '../../utils/fillEmptyArray';

describe('fillEmptyArray', () => {
  it('should return an array of undefined or empty array when value is an array', () => {
    expect(fillEmptyArray([1])).toEqual([undefined]);
    expect(fillEmptyArray([])).toEqual([]);
    expect(fillEmptyArray(['2', true])).toEqual([undefined, undefined]);
    expect(fillEmptyArray([{}, {}])).toEqual([undefined, undefined]);
    expect(fillEmptyArray([[], [3]])).toEqual([undefined, undefined]);
  });

  it('should return undefined when value is not an array', () => {
    expect(fillEmptyArray(1)).toEqual(undefined);
    expect(fillEmptyArray({})).toEqual(undefined);
    expect(fillEmptyArray('')).toEqual(undefined);
    expect(fillEmptyArray(true)).toEqual(undefined);
  });
});
