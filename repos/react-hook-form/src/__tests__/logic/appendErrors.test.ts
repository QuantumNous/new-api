import appendErrors from '../../logic/appendErrors';

describe('appendErrors', () => {
  it('should return empty object when validateAllFieldCriteria is false', () => {
    const errors = {
      test: {
        type: 'required',
        message: 'test',
      },
    };
    expect(appendErrors('test', false, errors, 'min', 'test')).toEqual({});
  });

  it('should return error object when validateAllFieldCriteria is true', () => {
    const errors = {
      test: {
        type: 'required',
        message: 'test',
        types: {},
      },
    };

    expect(appendErrors('test', true, errors, 'required', 'test')).toEqual({
      message: 'test',
      type: 'required',
      types: {
        required: 'test',
      },
    });

    errors.test.types = { required: 'test' };
    expect(appendErrors('test', true, errors, 'min', 'test')).toEqual({
      message: 'test',
      type: 'required',
      types: {
        required: 'test',
        min: 'test',
      },
    });

    errors.test.types = { ...errors.test.types, min: 'test' };
    expect(appendErrors('test', true, errors, 'max', 'test')).toEqual({
      message: 'test',
      type: 'required',
      types: {
        required: 'test',
        min: 'test',
        max: 'test',
      },
    });

    errors.test.types = { ...errors.test.types, max: 'test' };
    expect(appendErrors('test', true, errors, 'undefined', undefined)).toEqual({
      message: 'test',
      type: 'required',
      types: {
        required: 'test',
        min: 'test',
        max: 'test',
        undefined: true,
      },
    });

    errors.test.types = {
      ...errors.test.types,
      undefined: true,
    };
    expect(
      appendErrors('test', true, errors, 'invalid_string', [
        'uppercase',
        'lowercase',
        'number',
      ]),
    ).toEqual({
      message: 'test',
      type: 'required',
      types: {
        required: 'test',
        min: 'test',
        max: 'test',
        undefined: true,
        invalid_string: ['uppercase', 'lowercase', 'number'],
      },
    });
  });
});
