import swap from '../../utils/swap';

describe('swap', () => {
  it('should swap value positions', () => {
    const test1 = [1, 2, 3, 4];
    swap(test1, 1, 2);
    expect(test1).toEqual([1, 3, 2, 4]);

    const test2 = [
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
    ];
    swap(test2, 0, 2);
    expect(test2).toEqual([
      {
        firstName: '3',
        lastName: 'Luo',
        id: '75309979-e340-49eb-8016-5f67bfb56c1c',
      },
      {
        firstName: '2',
        lastName: 'Luo',
        id: '75309979-e340-49eb-8016-5f67bfb56c1c',
      },
      {
        firstName: '1',
        lastName: 'Luo',
        id: '75309979-e340-49eb-8016-5f67bfb56c1c',
      },
    ]);
  });

  it('should swap undefined position when index is not exists', () => {
    const test1 = [1, 2, 3, 4];
    swap(test1, 0, 4);
    expect(test1).toEqual([undefined, 2, 3, 4, 1]);

    const test2 = [1, 2, 3, 4];
    swap(test2, 2, 6);
    expect(test2).toEqual([1, 2, undefined, 4, undefined, undefined, 3]);
  });
});
