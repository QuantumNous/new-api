import { CommonPopupDataAttributes } from '../../utils/popupStateMapping';

export enum PreviewCardArrowDataAttributes {
  /**
   * Present when the preview card is open.
   */
  open = CommonPopupDataAttributes.open,
  /**
   * Present when the preview card is closed.
   */
  closed = CommonPopupDataAttributes.closed,
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
   * Present when the preview card arrow is uncentered.
   */
  uncentered = 'data-uncentered',
}
