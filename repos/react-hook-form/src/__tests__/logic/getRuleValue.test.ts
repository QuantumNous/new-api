import getRuleValue from '../../logic/getRuleValue';

describe('getRuleValue', () => {
  it('should return associated rule value', () => {
    expect(getRuleValue('1990/09/09')).toEqual('1990/09/09');
    expect(getRuleValue('2')).toEqual('2');
    expect(getRuleValue(2)).toEqual(2);

    expect(getRuleValue(/test/)).toEqual('test');

    expect(getRuleValue({ value: '2', message: 'data' })).toEqual('2');
    expect(getRuleValue({ value: '1990/09/09', message: 'data' })).toEqual(
      '1990/09/09',
    );
    expect(getRuleValue({ value: 2, message: 'data' })).toEqual(2);
    expect(getRuleValue({ value: /test/, message: 'data' })).toEqual('test');
  });

  it('should return undefined when no value is set', () => {
    expect(getRuleValue(undefined)).toBeUndefined();
  });
});
