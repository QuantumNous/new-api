import { CommonTriggerDataAttributes } from '../../utils/popupStateMapping';

export enum AlertDialogTriggerDataAttributes {
  /**
   * Present when the trigger is disabled.
   */
  disabled = 'data-disabled',
  /**
   * Present when the corresponding alert dialog is open.
   */
  popupOpen = CommonTriggerDataAttributes.popupOpen,
}
