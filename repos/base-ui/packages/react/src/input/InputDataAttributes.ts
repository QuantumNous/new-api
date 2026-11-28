export enum InputDataAttributes {
  /**
   * Present when the input is disabled.
   */
  disabled = 'data-disabled',
  /**
   * Present when the input is in a valid state (when wrapped in Field.Root).
   */
  valid = 'data-valid',
  /**
   * Present when the input is in an invalid state (when wrapped in Field.Root).
   */
  invalid = 'data-invalid',
  /**
   * Present when the input has been touched (when wrapped in Field.Root).
   */
  touched = 'data-touched',
  /**
   * Present when the input's value has changed (when wrapped in Field.Root).
   */
  dirty = 'data-dirty',
  /**
   * Present when the input is filled (when wrapped in Field.Root).
   */
  filled = 'data-filled',
  /**
   * Present when the input is focused (when wrapped in Field.Root).
   */
  focused = 'data-focused',
}
