import update from '../../utils/update';

describe('update', () => {
  it('should update element at index and mutate original array', () => {
    const data = [1, 2, 3];
    const result = update(data, 1, 99);

    expect(result).toEqual([1, 99, 3]);
    expect(result).toBe(data);
  });

  it('should work with object arrays', () => {
    const data = [
      {
        firstName: '1',
        lastName: 'Luo',
        id: '75309979-e340-49eb-8016-5f67bfb56c1c',
      },
      {
        firstName: '2',
        lastName: 'Luo',
        id: '75309979-e340-49eb-8016-5f67bfb56c1c',
      },
    ];
    update(data, 0, { firstName: 'Updated', lastName: 'Name', id: 'new-id' });

    expect(data[0]).toEqual({
      firstName: 'Updated',
      lastName: 'Name',
      id: 'new-id',
    });
  });

  it('should update with falsy values', () => {
    expect(update([1, 2, 3], 1, 0)).toEqual([1, 0, 3]);
    expect(update([true, true, true] as boolean[], 1, false)).toEqual([
      true,
      false,
      true,
    ]);
    expect(update(['a', 'b', 'c'], 1, '')).toEqual(['a', '', 'c']);
  });
});
