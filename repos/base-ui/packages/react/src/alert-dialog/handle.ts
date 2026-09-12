import { DialogHandle } from '../dialog/store/DialogHandle';
import { DialogStore } from '../dialog/store/DialogStore';

export const alertDialogState = {
  modal: true,
  disablePointerDismissal: true,
  role: 'alertdialog',
} as const;

/**
 * A handle to control an Alert Dialog imperatively and to associate detached triggers with it.
 */
export class AlertDialogHandle<Payload> extends DialogHandle<Payload> {
  private readonly __alertDialogBrand!: never;

  constructor(store?: DialogStore<Payload>) {
    const alertDialogStore = store ?? new DialogStore<Payload>(alertDialogState);
    super(alertDialogStore);

    if (store) {
      // Supplied stores may have been created as plain dialogs; enforce alert-dialog state.
      this.store.update(alertDialogState);
    }
  }
}

/**
 * Creates a new handle to connect an AlertDialog.Root with detached AlertDialog.Trigger components.
 */
export function createAlertDialogHandle<Payload>(): AlertDialogHandle<Payload> {
  return new AlertDialogHandle<Payload>();
}
