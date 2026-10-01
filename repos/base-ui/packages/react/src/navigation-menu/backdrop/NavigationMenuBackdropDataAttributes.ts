import { CommonPopupDataAttributes } from '../../utils/popupStateMapping';

export enum NavigationMenuBackdropDataAttributes {
  /**
   * Present when the popup is open.
   */
  open = CommonPopupDataAttributes.open,
  /**
   * Present when the popup is closed.
   */
  closed = CommonPopupDataAttributes.closed,
  /**
   * Present when the popup is animating in.
   */
  startingStyle = CommonPopupDataAttributes.startingStyle,
  /**
   * Present when the popup is animating out.
   */
  endingStyle = CommonPopupDataAttributes.endingStyle,
}
