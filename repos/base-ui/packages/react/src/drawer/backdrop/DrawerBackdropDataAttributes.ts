import { CommonPopupDataAttributes } from '../../utils/popupStateMapping';

export enum DrawerBackdropDataAttributes {
  /**
   * Present when the drawer is open.
   */
  open = CommonPopupDataAttributes.open,
  /**
   * Present when the drawer is closed.
   */
  closed = CommonPopupDataAttributes.closed,
  /**
   * Present when the drawer is animating in.
   */
  startingStyle = CommonPopupDataAttributes.startingStyle,
  /**
   * Present when the drawer is animating out.
   */
  endingStyle = CommonPopupDataAttributes.endingStyle,
}
