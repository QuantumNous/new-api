'use client';
import * as React from 'react';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { DialogHandle } from '../store/DialogHandle';
import { type PayloadChildRenderFunction } from '../../utils/popups';
import { IsDrawerContext } from './DialogRootContext';
import { useRenderDialogRoot } from './useRenderDialogRoot';

/**
 * Groups all parts of the dialog.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Dialog](https://base-ui.com/react/components/dialog)
 */
export function DialogRoot<Payload>(props: DialogRoot.Props<Payload>) {
  const mode = React.useContext(IsDrawerContext) ? 'drawer' : 'dialog';
  return useRenderDialogRoot(props, mode);
}

export interface DialogRootState {}

export interface DialogRootProps<Payload = unknown> {
  /**
   * Whether the dialog is currently open.
   */
  open?: boolean | undefined;
  /**
   * Whether the dialog is initially open.
   *
   * To render a controlled dialog, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Determines if the dialog enters a modal state when open.
   * - `true`: user interaction is limited to just the dialog: focus is trapped, document page scroll is locked, and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   * - `'trap-focus'`: focus is trapped inside the dialog, but document page scroll is not locked and pointer interactions outside of it remain enabled.
   *
   * When `modal` is `true` or `'trap-focus'`, render `<Dialog.Close>` inside `<Dialog.Popup>` so
   * touch screen readers can escape the popup.
   * @default true
   */
  modal?: boolean | 'trap-focus' | undefined;
  /**
   * Event handler called when the dialog is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: DialogRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the dialog is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether to prevent the dialog from closing on outside presses.
   * For non-modal dialogs, this also prevents the dialog from closing when focus moves outside of it.
   * @default false
   */
  disablePointerDismissal?: boolean | undefined;
  /**
   * A ref to imperative actions.
   * - `unmount`: Manually unmounts the dialog.
   * Call this after any externally controlled closing animation finishes.
   * - `close`: Closes the dialog imperatively when called.
   */
  actionsRef?: React.RefObject<DialogRoot.Actions | null> | undefined;
  /**
   * A handle to associate the dialog with a trigger.
   * If specified, allows external triggers to control the dialog's open state.
   * Can be created with the Dialog.createHandle() method.
   */
  handle?: DialogHandle<Payload> | undefined;
  /**
   * The content of the dialog.
   * This can be a regular React node or a render function that receives the `payload` of the active trigger.
   */
  children?: React.ReactNode | PayloadChildRenderFunction<Payload>;
  /**
   * ID of the trigger that the dialog is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled dialog.
   * There's no need to specify this prop when the dialog is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the dialog is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open dialog.
   */
  defaultTriggerId?: string | null | undefined;
}

export interface DialogRootActions {
  unmount: () => void;
  close: () => void;
}

export type DialogRootChangeEventReason =
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.closePress
  | typeof REASONS.focusOut
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type DialogRootChangeEventDetails =
  BaseUIChangeEventDetails<DialogRoot.ChangeEventReason> & {
    preventUnmountOnClose(): void;
  };

export namespace DialogRoot {
  export type State = DialogRootState;
  export type Props<Payload = unknown> = DialogRootProps<Payload>;
  export type Actions = DialogRootActions;
  export type ChangeEventReason = DialogRootChangeEventReason;
  export type ChangeEventDetails = DialogRootChangeEventDetails;
}
