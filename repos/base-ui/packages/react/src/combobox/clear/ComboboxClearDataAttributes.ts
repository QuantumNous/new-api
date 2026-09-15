import {
  CommonPopupDataAttributes,
  CommonTriggerDataAttributes,
} from '../../utils/popupStateMapping';

export enum ComboboxClearDataAttributes {
  /**
   * Present when the corresponding popup is open.
   */
  popupOpen = CommonTriggerDataAttributes.popupOpen,
  /**
   * Present when the button is disabled.
   */
  disabled = 'data-disabled',
  /**
   * Present when the clear button is visible.
   */
  visible = 'data-visible',
  /**
   * Present when the button is animating in.
   */
  startingStyle = CommonPopupDataAttributes.startingStyle,
  /**
   * Present when the button is animating out.
   */
  endingStyle = CommonPopupDataAttributes.endingStyle,
}
