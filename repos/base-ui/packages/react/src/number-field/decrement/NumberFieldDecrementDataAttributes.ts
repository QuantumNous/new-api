export enum NumberFieldDecrementDataAttributes {
  /**
   * Present while scrubbing.
   */
  scrubbing = 'data-scrubbing',
  /**
   * Present when the number field is disabled.
   */
  disabled = 'data-disabled',
  /**
   * Present when the number field is readonly.
   */
  readonly = 'data-readonly',
  /**
   * Present when the number field is required.
   */
  required = 'data-required',
  /**
   * Present when the number field is in a valid state (when wrapped in Field.Root).
   */
  valid = 'data-valid',
  /**
   * Present when the number field is in an invalid state (when wrapped in Field.Root).
   */
  invalid = 'data-invalid',
  /**
   * Present when the number field has been touched (when wrapped in Field.Root).
   */
  touched = 'data-touched',
  /**
   * Present when the number field's value has changed (when wrapped in Field.Root).
   */
  dirty = 'data-dirty',
  /**
   * Present when the number field is filled (when wrapped in Field.Root).
   */
  filled = 'data-filled',
  /**
   * Present when the number field is focused (when wrapped in Field.Root).
   */
  focused = 'data-focused',
}
