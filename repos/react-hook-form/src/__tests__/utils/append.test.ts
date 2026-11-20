import append from '../../utils/append';

describe('append', () => {
  it('should append a single value to an array', () => {
    const data = [1, 2, 3];
    const result = append(data, 4);

    expect(result).toEqual([1, 2, 3, 4]);
    expect(data).toEqual([1, 2, 3]);
  });

  it('should append multiple values from an array to an array', () => {
    const data = [1, 2, 3];
    const result = append(data, [4, 5, 6]);

    expect(result).toEqual([1, 2, 3, 4, 5, 6]);
    expect(data).toEqual([1, 2, 3]);
  });

  it('should append to an empty array', () => {
    const data: number[] = [];
    const result = append(data, 1);

    expect(result).toEqual([1]);
    expect(data).toEqual([]);
  });

  it('should append an array to an empty array', () => {
    const data: number[] = [];
    const result = append(data, [1, 2, 3]);

    expect(result).toEqual([1, 2, 3]);
    expect(data).toEqual([]);
  });

  it('should work with string arrays', () => {
    const data = ['a', 'b'];
    const result = append(data, 'c');

    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('should work with string arrays when appending multiple strings', () => {
    const data = ['a', 'b'];
    const result = append(data, ['c', 'd']);

    expect(result).toEqual(['a', 'b', 'c', 'd']);
  });

  it('should work with object arrays', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const result = append(data, { id: 3 });

    expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('should work with mixed type arrays when appending single value', () => {
    const data = [1, 'a', true];
    const result = append(data, null);

    expect(result).toEqual([1, 'a', true, null]);
  });

  it('should work with mixed type arrays when appending array', () => {
    const data = [1, 'a', false];
    const result = append(data, [true, null]);

    expect(result).toEqual([1, 'a', false, true, null]);
  });

  it('should handle nested arrays correctly', () => {
    const data = [
      [1, 2],
      [3, 4],
    ];
    const result = append(data, [[5, 6]]);

    expect(result).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });
});
