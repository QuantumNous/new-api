import { CommonTriggerDataAttributes } from '../../utils/popupStateMapping';

export enum AutocompleteTriggerDataAttributes {
  /**
   * Present when the corresponding popup is open.
   */
  popupOpen = CommonTriggerDataAttributes.popupOpen,
  /**
   * Present when the trigger is pressed.
   */
  pressed = CommonTriggerDataAttributes.pressed,
  /**
   * Present when the component is disabled.
   */
  disabled = 'data-disabled',
  /**
   * Present when the component is readonly.
   */
  readonly = 'data-readonly',
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   * @type {'top' | 'bottom' | 'left' | 'right' | 'inline-end' | 'inline-start' | null}
   */
  popupSide = 'data-popup-side',
  /**
   * Present when the component is required.
   */
  required = 'data-required',
  /**
   * Present when the component is in a valid state (when wrapped in Field.Root).
   */
  valid = 'data-valid',
  /**
   * Present when the component is in an invalid state (when wrapped in Field.Root).
   */
  invalid = 'data-invalid',
  /**
   * Present when the component has been touched (when wrapped in Field.Root).
   */
  touched = 'data-touched',
  /**
   * Present when the component's value has changed (when wrapped in Field.Root).
   */
  dirty = 'data-dirty',
  /**
   * Present when the component has a value (when wrapped in Field.Root).
   */
  filled = 'data-filled',
  /**
   * Present when the trigger is focused (when wrapped in Field.Root).
   */
  focused = 'data-focused',
  /**
   * Present when the corresponding items list is empty.
   */
  listEmpty = 'data-list-empty',
}
