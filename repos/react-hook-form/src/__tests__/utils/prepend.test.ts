import prepend from '../../utils/prepend';

describe('prepend', () => {
  it('should prepend value to an array', () => {
    expect(prepend([2, 3, 4], 1)).toEqual([1, 2, 3, 4]);
    expect(
      prepend(
        [
          {
            firstName: '2',
            lastName: 'Luo',
            id: '75309979-e340-49eb-8016-5f67bfb56c1c',
          },
          {
            firstName: '3',
            lastName: 'Luo',
            id: '75309979-e340-49eb-8016-5f67bfb56c1c',
          },
          {
            firstName: '4',
            lastName: 'Luo',
            id: '75309979-e340-49eb-8016-5f67bfb56c1c',
          },
        ],
        {
          firstName: '1',
          lastName: 'Luo',
          id: '75309979-e340-49eb-8016-5f67bfb56c1c',
        },
      ),
    ).toEqual([
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
      {
        firstName: '3',
        lastName: 'Luo',
        id: '75309979-e340-49eb-8016-5f67bfb56c1c',
      },
      {
        firstName: '4',
        lastName: 'Luo',
        id: '75309979-e340-49eb-8016-5f67bfb56c1c',
      },
    ]);
  });

  it('should prepend undefined as value when value to be prepended is falsy', () => {
    expect(prepend([2, 3, 4], 0)).toEqual([0, 2, 3, 4]);
    expect(prepend([2, 3, 4] as (number | boolean)[], false)).toEqual([
      false,
      2,
      3,
      4,
    ]);
    expect(prepend([2, 3, 4] as (number | string)[], '')).toEqual([
      '',
      2,
      3,
      4,
    ]);
    expect(prepend([2, 3, 4], undefined)).toEqual([undefined, 2, 3, 4]);
  });

  it('should spread value when it is an array at one deep-level', () => {
    expect(prepend([3, 4], [1, 2])).toEqual([1, 2, 3, 4]);
    expect(prepend([3, 4], [[1], 2])).toEqual([[1], 2, 3, 4]);
  });
});
