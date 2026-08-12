import { CommonTriggerDataAttributes } from '../../utils/popupStateMapping';

export enum SelectTriggerDataAttributes {
  /**
   * Present when the corresponding select is open.
   */
  popupOpen = CommonTriggerDataAttributes.popupOpen,
  /**
   * Present when the trigger is pressed.
   */
  pressed = CommonTriggerDataAttributes.pressed,
  /**
   * Present when the select is disabled.
   */
  disabled = 'data-disabled',
  /**
   * Present when the select is readonly.
   */
  readonly = 'data-readonly',
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   * @type {'top' | 'bottom' | 'left' | 'right' | 'inline-end' | 'inline-start' | null}
   */
  popupSide = 'data-popup-side',
  /**
   * Present when the select is required.
   */
  required = 'data-required',
  /**
   * Present when the select is in a valid state (when wrapped in Field.Root).
   */
  valid = 'data-valid',
  /**
   * Present when the select is in an invalid state (when wrapped in Field.Root).
   */
  invalid = 'data-invalid',
  /**
   * Present when the select has been touched (when wrapped in Field.Root).
   */
  touched = 'data-touched',
  /**
   * Present when the select's value has changed (when wrapped in Field.Root).
   */
  dirty = 'data-dirty',
  /**
   * Present when the select has a value (when wrapped in Field.Root).
   */
  filled = 'data-filled',
  /**
   * Present when the select trigger is focused (when wrapped in Field.Root).
   */
  focused = 'data-focused',
  /**
   * Present when the select doesn't have a value.
   */
  placeholder = 'data-placeholder',
}
