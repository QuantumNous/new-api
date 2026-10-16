import { CommonPopupDataAttributes } from '../../utils/popupStateMapping';

export enum MenuPopupDataAttributes {
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
  /**
   * Indicates which side the popup is positioned relative to the trigger.
   * @type {'top' | 'bottom' | 'left' | 'right' | 'inline-end' | 'inline-start'}
   */
  side = CommonPopupDataAttributes.side,
  /**
   * Indicates how the popup is aligned relative to specified side.
   * @type {'start' | 'center' | 'end'}
   */
  align = CommonPopupDataAttributes.align,
  /**
   * Present if animations should be instant.
   * @type {'click' | 'dismiss' | 'group' | 'trigger-change'}
   */
  instant = 'data-instant',
}
