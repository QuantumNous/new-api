import hasValidation from '../../logic/hasValidation';
import type { Field } from '../../types';

describe('hasValidation', () => {
  it('should return false if mount is not defined', () => {
    const noMount = { required: true } as Field['_f'];
    expect(hasValidation(noMount)).toBeFalsy();
  });
  const base = { mount: true } as Field['_f'];

  it('should return false when field is not mounted', () => {
    expect(hasValidation({ ...base, mount: false })).toBeFalsy();
  });

  it('should return false when there is no validation rule', () => {
    expect(hasValidation(base)).toBeFalsy();
  });

  it('should return true when required is a string message', () => {
    expect(hasValidation({ ...base, required: 'This field is required' })).toBe(
      'This field is required',
    );
  });

  it('should return false when validation rules are explicity falsy', () => {
    expect(hasValidation({ ...base, required: false })).toBeFalsy();
    expect(hasValidation({ ...base, validate: undefined })).toBeFalsy();
  });

  it('should return false for falsy but valid numeric values like min: 0, max: 0, minLength: 0 or maxLength: 0', () => {
    expect(hasValidation({ ...base, min: 0 })).toBeFalsy();
    expect(hasValidation({ ...base, minLength: 0 })).toBeFalsy();
    expect(hasValidation({ ...base, max: 0 })).toBeFalsy();
    expect(hasValidation({ ...base, maxLength: 0 })).toBeFalsy();
  });

  it('should return true when any validation rule is provided', () => {
    expect(hasValidation({ ...base, required: true })).toBe(true);
    expect(hasValidation({ ...base, min: 1 })).toBe(1);
    expect(hasValidation({ ...base, max: 10 })).toBe(10);
    expect(hasValidation({ ...base, minLength: 2 })).toBe(2);
    expect(hasValidation({ ...base, maxLength: 20 })).toBe(20);
    expect(hasValidation({ ...base, validate: () => true })).toBeTruthy();
  });

  it('should return true when pattern is provided', () => {
    expect(
      hasValidation({
        ...base,
        pattern: /test/,
        valueAsDate: false,
        valueAsNumber: false,
      }),
    ).toStrictEqual(/test/);
    expect(
      hasValidation({
        ...base,
        pattern: { value: /test/, message: 'invalid' },
        valueAsDate: false,
        valueAsNumber: false,
      }),
    ).toStrictEqual({ value: /test/, message: 'invalid' });
  });

  it('should return false when pattern is undefined or null', () => {
    type TestFieldForPatternOnly = Field['_f'] & {
      pattern: null;
    };
    expect(
      hasValidation({
        ...base,
        pattern: undefined,
        valueAsDate: false,
        valueAsNumber: false,
      }),
    ).toBeFalsy();

    expect(
      hasValidation({ ...base, pattern: null } as TestFieldForPatternOnly),
    ).toBeFalsy();
  });

  it('should return pattern even when valueAsDate and valueAsNumber are not provided', () => {
    type TestFieldForPatternOnly = Field['_f'] & {
      pattern: RegExp;
    };
    expect(
      hasValidation({
        ...base,
        pattern: /test/,
      } as TestFieldForPatternOnly),
    ).toStrictEqual(/test/);
  });

  it('should return true when validate is an object', () => {
    const validateObj = {
      isValid: () => true,
      isEmail: () => false,
    };
    expect(hasValidation({ ...base, validate: validateObj })).toBe(validateObj);
  });
});
