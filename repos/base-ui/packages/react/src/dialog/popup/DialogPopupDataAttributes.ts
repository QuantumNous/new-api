import { CommonPopupDataAttributes } from '../../utils/popupStateMapping';

export enum DialogPopupDataAttributes {
  /**
   * Present when the dialog is open.
   */
  open = CommonPopupDataAttributes.open,
  /**
   * Present when the dialog is closed.
   */
  closed = CommonPopupDataAttributes.closed,
  /**
   * Present when the dialog is animating in.
   */
  startingStyle = CommonPopupDataAttributes.startingStyle,
  /**
   * Present when the dialog is animating out.
   */
  endingStyle = CommonPopupDataAttributes.endingStyle,
  /**
   * Present when the dialog is nested within another dialog.
   */
  nested = 'data-nested',
  /**
   * Present when the dialog has other open dialogs nested within it.
   */
  nestedDialogOpen = 'data-nested-dialog-open',
}
