import isFunction from '../../utils/isFunction';

describe('isFunction', () => {
  it('should return true when value is a function', () => {
    expect(isFunction(() => null)).toBeTruthy();
    expect(
      isFunction(function foo() {
        return null;
      }),
    ).toBeTruthy();
  });

  it('should return false when value is not a function', () => {
    expect(isFunction(null)).toBeFalsy();
    expect(isFunction(undefined)).toBeFalsy();
    expect(isFunction(-1)).toBeFalsy();
    expect(isFunction(0)).toBeFalsy();
    expect(isFunction(1)).toBeFalsy();
    expect(isFunction('')).toBeFalsy();
    expect(isFunction({})).toBeFalsy();
    expect(isFunction([])).toBeFalsy();
  });
});
