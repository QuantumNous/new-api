import { VALIDATION_MODE } from '../../constants';
import getValidationModes from '../../logic/getValidationModes';

describe('getValidationModes', () => {
  it('shold return correct flags for each mode', () => {
    expect(getValidationModes(VALIDATION_MODE.onBlur)).toEqual({
      isOnSubmit: false,
      isOnBlur: true,
      isOnChange: false,
      isOnAll: false,
      isOnTouch: false,
    });

    expect(getValidationModes(VALIDATION_MODE.onChange)).toEqual({
      isOnSubmit: false,
      isOnBlur: false,
      isOnChange: true,
      isOnAll: false,
      isOnTouch: false,
    });

    expect(getValidationModes(VALIDATION_MODE.onSubmit)).toEqual({
      isOnSubmit: true,
      isOnBlur: false,
      isOnChange: false,
      isOnAll: false,
      isOnTouch: false,
    });

    expect(getValidationModes(undefined)).toEqual({
      isOnSubmit: true,
      isOnBlur: false,
      isOnChange: false,
      isOnAll: false,
      isOnTouch: false,
    });

    expect(getValidationModes(VALIDATION_MODE.all)).toEqual({
      isOnSubmit: false,
      isOnBlur: false,
      isOnChange: false,
      isOnAll: true,
      isOnTouch: false,
    });

    expect(getValidationModes(VALIDATION_MODE.onTouched)).toEqual({
      isOnSubmit: false,
      isOnBlur: false,
      isOnChange: false,
      isOnAll: false,
      isOnTouch: true,
    });
  });
});
