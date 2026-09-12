import isBoolean from '../../utils/isBoolean';

describe('isBoolean', () => {
  it('should return true when value is a boolean', () => {
    expect(isBoolean(true)).toBeTruthy();
    expect(isBoolean(false)).toBeTruthy();
  });

  it('should return false when value is not a boolean', () => {
    expect(isBoolean(null)).toBeFalsy();
    expect(isBoolean(undefined)).toBeFalsy();
    expect(isBoolean(-1)).toBeFalsy();
    expect(isBoolean(0)).toBeFalsy();
    expect(isBoolean(1)).toBeFalsy();
    expect(isBoolean('')).toBeFalsy();
    expect(isBoolean({})).toBeFalsy();
    expect(isBoolean([])).toBeFalsy();
    expect(isBoolean(() => null)).toBeFalsy();
  });
});
