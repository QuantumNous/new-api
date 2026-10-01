'use client';
import * as React from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import styles from '../../_index.module.css';

type AlertPayload = { message: string };

const demoAlertDialog = AlertDialog.createHandle<AlertPayload>();

export default function AlertDialogDetachedTriggersControlledDemo() {
  const [open, setOpen] = React.useState(false);
  const [triggerId, setTriggerId] = React.useState<string | null>(null);

  const handleOpenChange = (isOpen: boolean, eventDetails: AlertDialog.Root.ChangeEventDetails) => {
    setOpen(isOpen);
    setTriggerId(eventDetails.trigger?.id ?? null);
  };

  return (
    <React.Fragment>
      <div className={styles.Container}>
        <AlertDialog.Trigger
          className={`${styles.Button} ${styles.DangerButton}`}
          handle={demoAlertDialog}
          id="alert-trigger-1"
          payload={{ message: 'Discard draft?' }}
        >
          Discard
        </AlertDialog.Trigger>

        <AlertDialog.Trigger
          className={`${styles.Button} ${styles.DangerButton}`}
          handle={demoAlertDialog}
          id="alert-trigger-2"
          payload={{ message: 'Delete project?' }}
        >
          Delete
        </AlertDialog.Trigger>

        <AlertDialog.Trigger
          className={styles.Button}
          handle={demoAlertDialog}
          id="alert-trigger-3"
          payload={{ message: 'Sign out?' }}
        >
          Sign out
        </AlertDialog.Trigger>

        <button
          className={styles.Button}
          type="button"
          onClick={() => {
            setTriggerId('alert-trigger-2');
            setOpen(true);
          }}
        >
          Open programmatically
        </button>
      </div>

      <AlertDialog.Root<AlertPayload>
        handle={demoAlertDialog}
        open={open}
        onOpenChange={handleOpenChange}
        triggerId={triggerId}
      >
        {({ payload }) => (
          <AlertDialog.Portal>
            <AlertDialog.Backdrop className={styles.Backdrop} />
            <AlertDialog.Popup className={styles.Popup}>
              <div className={styles.Intro}>
                <AlertDialog.Title className={styles.Title}>
                  {payload?.message ?? 'Are you sure?'}
                </AlertDialog.Title>
                <AlertDialog.Description className={styles.Description}>
                  This action cannot be undone.
                </AlertDialog.Description>
              </div>
              <div className={styles.Actions}>
                <AlertDialog.Close className={styles.Button}>Cancel</AlertDialog.Close>
                <AlertDialog.Close className={`${styles.Button} ${styles.DangerButton}`}>
                  Confirm
                </AlertDialog.Close>
              </div>
            </AlertDialog.Popup>
          </AlertDialog.Portal>
        )}
      </AlertDialog.Root>
    </React.Fragment>
  );
}
