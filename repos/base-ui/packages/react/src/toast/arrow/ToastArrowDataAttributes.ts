import { CommonPopupDataAttributes } from '../../utils/popupStateMapping';

export enum ToastArrowDataAttributes {
  /**
   * Indicates which side the toast is positioned relative to the anchor.
   * @type {'top' | 'bottom' | 'left' | 'right' | 'inline-end' | 'inline-start'}
   */
  side = CommonPopupDataAttributes.side,
  /**
   * Indicates how the toast is aligned relative to specified side.
   * @type {'start' | 'center' | 'end'}
   */
  align = CommonPopupDataAttributes.align,
  /**
   * Present when the toast arrow is uncentered.
   */
  uncentered = 'data-uncentered',
}
