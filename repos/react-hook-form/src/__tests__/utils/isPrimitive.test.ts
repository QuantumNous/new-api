import isPrimitive from '../../utils/isPrimitive';

describe('isPrimitive', () => {
  it('should return true when value is a string', () => {
    expect(isPrimitive('foobar')).toBeTruthy();
  });

  it('should return true when value is a boolean', () => {
    expect(isPrimitive(false)).toBeTruthy();
  });

  it('should return true when value is a number', () => {
    expect(isPrimitive(123)).toBeTruthy();
  });

  it('should return true when value is a symbol', () => {
    expect(isPrimitive(Symbol())).toBeTruthy();
  });

  it('should return true when value is null', () => {
    expect(isPrimitive(null)).toBeTruthy();
  });

  it('should return true when value is undefined', () => {
    expect(isPrimitive(undefined)).toBeTruthy();
  });

  it('should return false when value is an object', () => {
    expect(isPrimitive({})).toBeFalsy();
  });

  it('should return false when value is an array', () => {
    expect(isPrimitive([])).toBeFalsy();
  });
});
