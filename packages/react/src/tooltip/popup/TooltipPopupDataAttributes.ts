import { CommonPopupDataAttributes } from '../../utils/popupStateMapping';

export enum TooltipPopupDataAttributes {
  /**
   * Present when the tooltip is open.
   */
  open = CommonPopupDataAttributes.open,
  /**
   * Present when the tooltip is closed.
   */
  closed = CommonPopupDataAttributes.closed,
  /**
   * Present when the tooltip is animating in.
   */
  startingStyle = CommonPopupDataAttributes.startingStyle,
  /**
   * Present when the tooltip is animating out.
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
   * @type {'delay' | 'dismiss' | 'focus'}
   */
  instant = 'data-instant',
}
