import { CommonPopupDataAttributes } from '../../utils/popupStateMapping';

export enum MenuBackdropDataAttributes {
  /**
   * Present when the menu is open.
   */
  open = CommonPopupDataAttributes.open,
  /**
   * Present when the menu is closed.
   */
  closed = CommonPopupDataAttributes.closed,
  /**
   * Present when the menu is animating in.
   */
  startingStyle = CommonPopupDataAttributes.startingStyle,
  /**
   * Present when the menu is animating out.
   */
  endingStyle = CommonPopupDataAttributes.endingStyle,
}
