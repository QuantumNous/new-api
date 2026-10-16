import { CommonPopupDataAttributes } from '../../utils/popupStateMapping';

export enum PopoverPopupDataAttributes {
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
  /**
   * Indicates which side the popup is positioned relative to the trigger.
   * @type {'top' | 'bottom' | 'left' | 'right' | 'inline-end' | 'inline-start'}
   */
  side = 'data-side',
  /**
   * Indicates how the popup is aligned relative to specified side.
   * @type {'start' | 'center' | 'end'}
   */
  align = 'data-align',
  /**
   * Present if animations should be instant.
   * @type {'click' | 'dismiss' | 'focus' | 'trigger-change'}
   */
  instant = 'data-instant',
}
