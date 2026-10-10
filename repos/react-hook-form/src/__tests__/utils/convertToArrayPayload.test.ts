import convertToArrayPayload from '../../utils/convertToArrayPayload';

describe('convertToArrayPayload', () => {
  it('should return the same array when input is already an array', () => {
    const arr = [1, 2, 3];
    expect(convertToArrayPayload(arr)).toStrictEqual(arr);
  });

  it('should wrap non-array values into an array', () => {
    expect(convertToArrayPayload(1)).toStrictEqual([1]);
    expect(convertToArrayPayload('test')).toStrictEqual(['test']);
    const object = {
      a: 'test',
    };
    expect(convertToArrayPayload(object)).toStrictEqual([object]);
  });
});
