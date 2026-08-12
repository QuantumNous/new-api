import { TransitionStatusDataAttributes } from '../../internals/stateAttributesMapping';

export enum CheckboxIndicatorDataAttributes {
  /**
   * Present when the checkbox is checked.
   */
  checked = 'data-checked',
  /**
   * Present when the checkbox is not checked.
   */
  unchecked = 'data-unchecked',
  /**
   * Present when the checkbox is in an indeterminate state.
   */
  indeterminate = 'data-indeterminate',
  /**
   * Present when the checkbox is disabled.
   */
  disabled = 'data-disabled',
  /**
   * Present when the checkbox is readonly.
   */
  readonly = 'data-readonly',
  /**
   * Present when the checkbox is required.
   */
  required = 'data-required',
  /**
   * Present when the checkbox indicator is animating in.
   */
  startingStyle = TransitionStatusDataAttributes.startingStyle,
  /**
   * Present when the checkbox indicator is animating out.
   */
  endingStyle = TransitionStatusDataAttributes.endingStyle,
  /**
   * Present when the checkbox is in a valid state (when wrapped in Field.Root).
   */
  valid = 'data-valid',
  /**
   * Present when the checkbox is in an invalid state (when wrapped in Field.Root).
   */
  invalid = 'data-invalid',
  /**
   * Present when the checkbox has been touched (when wrapped in Field.Root).
   */
  touched = 'data-touched',
  /**
   * Present when the checkbox's value has changed (when wrapped in Field.Root).
   */
  dirty = 'data-dirty',
  /**
   * Present when the checkbox is checked (when wrapped in Field.Root).
   */
  filled = 'data-filled',
  /**
   * Present when the checkbox is focused (when wrapped in Field.Root).
   */
  focused = 'data-focused',
}
