import isUndefined from '../../utils/isUndefined';

describe('isUndefined', () => {
  it('should return true when it is an undefined value', () => {
    expect(isUndefined(undefined)).toBeTruthy();
  });

  it('should return false when it is not an undefined value', () => {
    expect(isUndefined(null)).toBeFalsy();
    expect(isUndefined('')).toBeFalsy();
    expect(isUndefined('undefined')).toBeFalsy();
    expect(isUndefined(0)).toBeFalsy();
    expect(isUndefined([])).toBeFalsy();
    expect(isUndefined({})).toBeFalsy();
  });
});
