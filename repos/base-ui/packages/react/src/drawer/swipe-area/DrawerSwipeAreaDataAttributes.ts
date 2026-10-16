import { CommonPopupDataAttributes } from '../../utils/popupStateMapping';

export enum DrawerSwipeAreaDataAttributes {
  /**
   * Present when the drawer is open.
   */
  open = CommonPopupDataAttributes.open,
  /**
   * Present when the drawer is closed.
   */
  closed = CommonPopupDataAttributes.closed,
  /**
   * Present when the swipe area is disabled.
   */
  disabled = 'data-disabled',
  /**
   * Indicates the swipe direction.
   * @type {'up' | 'down' | 'left' | 'right'}
   */
  swipeDirection = 'data-swipe-direction',
  /**
   * Present when the drawer is being swiped.
   */
  swiping = 'data-swiping',
}
