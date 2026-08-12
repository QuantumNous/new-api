export enum OTPFieldInputDataAttributes {
  /**
   * Present when all slots are filled.
   */
  complete = 'data-complete',
  /**
   * Present when the input contains a character.
   */
  filled = 'data-filled',
  /**
   * Present when the OTP field is disabled.
   */
  disabled = 'data-disabled',
  /**
   * Present when the OTP field is readonly.
   */
  readonly = 'data-readonly',
  /**
   * Present when the OTP field is required.
   */
  required = 'data-required',
  /**
   * Present when the OTP field is in a valid state (when wrapped in Field.Root).
   */
  valid = 'data-valid',
  /**
   * Present when the OTP field is in an invalid state (when wrapped in Field.Root).
   */
  invalid = 'data-invalid',
  /**
   * Present when the OTP field has been touched (when wrapped in Field.Root).
   */
  touched = 'data-touched',
  /**
   * Present when the OTP field's value has changed (when wrapped in Field.Root).
   */
  dirty = 'data-dirty',
  /**
   * Present when any OTP field input is focused.
   */
  focused = 'data-focused',
}
