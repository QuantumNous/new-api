export enum SwitchRootDataAttributes {
  /**
   * Present when the switch is checked.
   */
  checked = 'data-checked',
  /**
   * Present when the switch is not checked.
   */
  unchecked = 'data-unchecked',
  /**
   * Present when the switch is disabled.
   */
  disabled = 'data-disabled',
  /**
   * Present when the switch is readonly.
   */
  readonly = 'data-readonly',
  /**
   * Present when the switch is required.
   */
  required = 'data-required',
  /**
   * Present when the switch is in a valid state (when wrapped in Field.Root).
   */
  valid = 'data-valid',
  /**
   * Present when the switch is in an invalid state (when wrapped in Field.Root).
   */
  invalid = 'data-invalid',
  /**
   * Present when the switch has been touched (when wrapped in Field.Root).
   */
  touched = 'data-touched',
  /**
   * Present when the switch's value has changed (when wrapped in Field.Root).
   */
  dirty = 'data-dirty',
  /**
   * Present when the switch is active (when wrapped in Field.Root).
   */
  filled = 'data-filled',
  /**
   * Present when the switch is focused (when wrapped in Field.Root).
   */
  focused = 'data-focused',
}
