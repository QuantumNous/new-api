import getCheckboxValue from '../../logic/getCheckboxValue';

describe('getCheckboxValue', () => {
  it('should return default value if not valid or empty options', () => {
    expect(getCheckboxValue(undefined)).toEqual({
      value: false,
      isValid: false,
    });
  });

  it('should return checked value if single checkbox is checked', () => {
    expect(
      getCheckboxValue([
        {
          name: 'bill',
          checked: true,
          value: '3',
          // @ts-expect-error this is a mock for html input
          attributes: { value: '3' },
        },
      ]),
    ).toEqual({ value: '3', isValid: true });
  });

  it('should return true if single checkbox is checked and has no value', () => {
    expect(
      // @ts-expect-error this is a mock for html input
      getCheckboxValue([{ name: 'bill', checked: true, attributes: {} }]),
    ).toEqual({ value: true, isValid: true });
  });

  it('should return true if single checkbox is checked and has empty value', () => {
    expect(
      getCheckboxValue([
        {
          name: 'bill',
          checked: true,
          value: '',
          // @ts-expect-error this is a mock for html input
          attributes: { value: 'test' },
        },
      ]),
    ).toEqual({ value: true, isValid: true });
    expect(
      getCheckboxValue([
        {
          name: 'bill',
          checked: true,
          // @ts-expect-error this is a mock for html input
          attributes: { value: 'test' },
        },
      ]),
    ).toEqual({ value: true, isValid: true });
  });

  it('should return false if single checkbox is un-checked', () => {
    expect(
      getCheckboxValue([
        {
          name: 'bill',
          checked: false,
          // @ts-expect-error this is a mock for html input
          attributes: {},
        },
      ]),
    ).toEqual({ value: false, isValid: false });
  });

  it('should return multiple selected values', () => {
    expect(
      getCheckboxValue([
        {
          name: 'bill',
          checked: true,
          value: '2',
          // @ts-expect-error this is a mock for html input
          attributes: { value: '2' },
        },
        {
          name: 'bill',
          checked: true,
          value: '3',
          // @ts-expect-error this is a mock for html input
          attributes: { value: '3' },
        },
      ]),
    ).toEqual({ value: ['2', '3'], isValid: true });
  });

  it('should return values for checked boxes only', () => {
    expect(
      getCheckboxValue([
        {
          name: 'bill',
          checked: false,
          value: '2',
          // @ts-expect-error this is a mock for html input
          attributes: { value: '2' },
        },
        {
          name: 'bill',
          checked: true,
          value: '3',
          // @ts-expect-error this is a mock for html input
          attributes: { value: '3' },
        },
        {
          name: 'bill',
          checked: false,
          value: '4',
          // @ts-expect-error this is a mock for html input
          attributes: { value: '4' },
        },
      ]),
    ).toEqual({ value: ['3'], isValid: true });
  });

  it('should return empty array for multi checkbox with no checked box', () => {
    expect(
      getCheckboxValue([
        {
          name: 'bill',
          checked: false,
          value: '2',
          // @ts-expect-error this is a mock for html input
          attributes: { value: '2' },
        },
        {
          name: 'bill',
          checked: false,
          value: '3',
          // @ts-expect-error this is a mock for html input
          attributes: { value: '3' },
        },
      ]),
    ).toEqual({ value: [], isValid: false });
  });

  it('should not return error when check box ref is undefined', () => {
    expect(
      getCheckboxValue([
        // @ts-expect-error this is a mock for html input
        undefined,
        {
          name: 'bill',
          checked: false,
          value: '2',
          // @ts-expect-error this is a mock for html input
          attributes: { value: '2' },
        },
      ]),
    ).toEqual({ value: [], isValid: false });
  });

  it('should return disabled input result', () => {
    expect(
      getCheckboxValue([
        {
          name: 'bill',
          checked: true,
          value: '2',
          disabled: true,
          // @ts-expect-error this is a mock for html input
          attributes: { value: '2' },
        },
        {
          name: 'bill',
          checked: true,
          value: '3',
          // @ts-expect-error this is a mock for html input
          attributes: { value: '3' },
        },
      ]),
    ).toEqual({
      value: ['3'],
      isValid: true,
    });

    expect(
      getCheckboxValue([
        {
          name: 'bill',
          checked: true,
          value: '2',
          disabled: true,
          // @ts-expect-error this is a mock for html input
          attributes: { value: '2' },
        },
        {
          name: 'bill',
          disabled: true,
          checked: true,
          value: '3',
          // @ts-expect-error this is a mock for html input
          attributes: { value: '3' },
        },
      ]),
    ).toEqual({
      value: [],
      isValid: false,
    });

    expect(
      getCheckboxValue([
        {
          name: 'bill',
          checked: true,
          value: '2',
          disabled: true,
          // @ts-expect-error this is a mock for html input
          attributes: { value: '2' },
        },
      ]),
    ).toEqual({
      value: false,
      isValid: false,
    });
  });
});
