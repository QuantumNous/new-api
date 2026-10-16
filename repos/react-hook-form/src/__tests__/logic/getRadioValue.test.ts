import getRadioValue from '../../logic/getRadioValue';

describe('getRadioValue', () => {
  it('should return default value if not valid or empty options', () => {
    expect(getRadioValue(undefined)).toEqual({
      isValid: false,
      value: null,
    });
  });

  it('should return valid to true when value found', () => {
    expect(
      getRadioValue([
        { name: 'bill', checked: false, value: '1' } as HTMLInputElement,
        { name: 'bill', checked: true, value: '2' } as HTMLInputElement,
      ]),
    ).toEqual({
      isValid: true,
      value: '2',
    });
  });

  it('should return disabled input correctly', () => {
    expect(
      getRadioValue([
        {
          name: 'bill',
          checked: false,
          value: '1',
          disabled: true,
        } as HTMLInputElement,
        { name: 'bill', checked: true, value: '2' } as HTMLInputElement,
      ]),
    ).toEqual({
      isValid: true,
      value: '2',
    });

    expect(
      getRadioValue([
        {
          name: 'bill',
          checked: false,
          value: '1',
        } as HTMLInputElement,
        {
          name: 'bill',
          checked: true,
          disabled: true,
          value: '2',
        } as HTMLInputElement,
      ]),
    ).toEqual({
      isValid: false,
      value: null,
    });
  });
});
