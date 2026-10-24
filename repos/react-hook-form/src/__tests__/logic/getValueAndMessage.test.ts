import getValueAndMessage from '../../logic/getValueAndMessage';

describe('getValueAndMessage', () => {
  it('should return message and value correctly', () => {
    expect(getValueAndMessage(0).value).toEqual(0);
    expect(getValueAndMessage(3).value).toEqual(3);
    expect(getValueAndMessage({ value: 0, message: 'what' }).value).toEqual(0);
    expect(getValueAndMessage({ value: 2, message: 'what' }).value).toEqual(2);
    expect(getValueAndMessage({ value: 1, message: 'test' }).message).toEqual(
      'test',
    );
  });
});
