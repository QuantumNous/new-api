import type { ValidationModeFlags } from '../types';

export default (
  isBlurEvent: boolean,
  isTouched: boolean,
  isSubmitted: boolean,
  reValidateMode: Pick<ValidationModeFlags, 'isOnBlur' | 'isOnChange'>,
  mode: Partial<ValidationModeFlags>,
) => {
  if (mode.isOnAll) {
    return false;
  } else if (!isSubmitted && mode.isOnTouch) {
    return !(isTouched || isBlurEvent);
  } else if (isSubmitted ? reValidateMode.isOnBlur : mode.isOnBlur) {
    return !isBlurEvent;
  } else if (isSubmitted ? reValidateMode.isOnChange : mode.isOnChange) {
    return isBlurEvent;
  }
  return true;
};
