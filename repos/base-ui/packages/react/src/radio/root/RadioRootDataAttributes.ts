export enum RadioRootDataAttributes {
  /**
   * Present when the radio is checked.
   */
  checked = 'data-checked',
  /**
   * Present when the radio is not checked.
   */
  unchecked = 'data-unchecked',
  /**
   * Present when the radio is disabled.
   */
  disabled = 'data-disabled',
  /**
   * Present when the radio is readonly.
   */
  readonly = 'data-readonly',
  /**
   * Present when the radio is required.
   */
  required = 'data-required',
  /**
   * Present when the radio is in a valid state (when wrapped in Field.Root).
   */
  valid = 'data-valid',
  /**
   * Present when the radio is in an invalid state (when wrapped in Field.Root).
   */
  invalid = 'data-invalid',
  /**
   * Present when the radio has been touched (when wrapped in Field.Root).
   */
  touched = 'data-touched',
  /**
   * Present when the radio's value has changed (when wrapped in Field.Root).
   */
  dirty = 'data-dirty',
  /**
   * Present when the radio is checked (when wrapped in Field.Root).
   */
  filled = 'data-filled',
  /**
   * Present when the radio is focused (when wrapped in Field.Root).
   */
  focused = 'data-focused',
}
