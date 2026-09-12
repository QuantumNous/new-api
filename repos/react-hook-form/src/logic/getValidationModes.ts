import { VALIDATION_MODE } from '../constants';
import type { Mode, ValidationModeFlags } from '../types';

export default (mode?: Mode): ValidationModeFlags => ({
  isOnSubmit: !mode || mode === VALIDATION_MODE.onSubmit,
  isOnBlur: mode === VALIDATION_MODE.onBlur,
  isOnChange: mode === VALIDATION_MODE.onChange,
  isOnAll: mode === VALIDATION_MODE.all,
  isOnTouch: mode === VALIDATION_MODE.onTouched,
});
