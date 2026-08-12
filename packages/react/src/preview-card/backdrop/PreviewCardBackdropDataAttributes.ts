import { CommonPopupDataAttributes } from '../../utils/popupStateMapping';

export enum PreviewCardBackdropDataAttributes {
  /**
   * Present when the preview card is open.
   */
  open = CommonPopupDataAttributes.open,
  /**
   * Present when the preview card is closed.
   */
  closed = CommonPopupDataAttributes.closed,
  /**
   * Present when the preview card is animating in.
   */
  startingStyle = CommonPopupDataAttributes.startingStyle,
  /**
   * Present when the preview card is animating out.
   */
  endingStyle = CommonPopupDataAttributes.endingStyle,
}
