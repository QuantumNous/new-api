import { CommonTriggerDataAttributes } from '../../utils/popupStateMapping';

export enum ContextMenuTriggerDataAttributes {
  /**
   * Present when the corresponding context menu is open.
   */
  popupOpen = CommonTriggerDataAttributes.popupOpen,
  /**
   * Present when the trigger is pressed.
   */
  pressed = CommonTriggerDataAttributes.pressed,
}
