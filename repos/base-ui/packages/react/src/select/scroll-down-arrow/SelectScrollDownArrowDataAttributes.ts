import { CommonPopupDataAttributes } from '../../utils/popupStateMapping';

export enum SelectScrollDownArrowDataAttributes {
  /**
   * Present when the scroll arrow is animating in.
   */
  startingStyle = CommonPopupDataAttributes.startingStyle,
  /**
   * Present when the scroll arrow is animating out.
   */
  endingStyle = CommonPopupDataAttributes.endingStyle,
  /**
   * Indicates the direction of the scroll arrow.
   * @type {'down'}
   */
  direction = 'data-direction',
  /**
   * Present when the scroll arrow is visible.
   */
  visible = 'data-visible',
  /**
   * Indicates which side the popup is positioned relative to the trigger.
   * @type {'none' | 'top' | 'bottom' | 'left' | 'right' | 'inline-end' | 'inline-start'}
   */
  side = CommonPopupDataAttributes.side,
}
