export enum SliderRootDataAttributes {
  /**
   * Present while the user is dragging.
   */
  dragging = 'data-dragging',
  /**
   * Indicates the orientation of the slider.
   * @type {'horizontal' | 'vertical'}
   */
  orientation = 'data-orientation',
  /**
   * Present when the slider is disabled.
   */
  disabled = 'data-disabled',
  /**
   * Present when the slider is in a valid state (when wrapped in Field.Root).
   */
  valid = 'data-valid',
  /**
   * Present when the slider is in an invalid state (when wrapped in Field.Root).
   */
  invalid = 'data-invalid',
  /**
   * Present when the slider has been touched (when wrapped in Field.Root).
   */
  touched = 'data-touched',
  /**
   * Present when the slider's value has changed (when wrapped in Field.Root).
   */
  dirty = 'data-dirty',
  /**
   * Present when the slider is focused (when wrapped in Field.Root).
   */
  focused = 'data-focused',
}
