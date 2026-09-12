import move from '../../utils/move';

describe('move', () => {
  it('should be able to move element of array', () => {
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
      {
        firstName: '3',
        lastName: 'Luo',
        id: '75309979-e340-49eb-8016-5f67bfb56c1c',
      },
    ];
    move(data, 0, 2);
    expect(data).toEqual([
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
        firstName: '1',
        lastName: 'Luo',
        id: '75309979-e340-49eb-8016-5f67bfb56c1c',
      },
    ]);
  });

  it('should return empty array when data passed was not an array', () => {
    // @ts-expect-error we want to test function on non-array input
    expect(move({}, 0, 3)).toEqual([]);
  });

  it('should move nested item with empty slot', () => {
    expect(move([{ subFields: [{ test: '1' }] }], 0, 1)).toEqual([
      undefined,
      { subFields: [{ test: '1' }] },
    ]);

    expect(move([{ subFields: [{ test: '1' }] }], 0, 2)).toEqual([
      undefined,
      undefined,
      { subFields: [{ test: '1' }] },
    ]);
  });
});
