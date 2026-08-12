'use client';
import * as React from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import styles from '../../_index.module.css';

const demoAlertDialog = AlertDialog.createHandle();

export default function AlertDialogDetachedTriggersSimpleDemo() {
  return (
    <React.Fragment>
      <AlertDialog.Trigger
        className={`${styles.Button} ${styles.DangerButton}`}
        handle={demoAlertDialog}
      >
        Discard draft
      </AlertDialog.Trigger>

      <AlertDialog.Root handle={demoAlertDialog}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className={styles.Backdrop} />
          <AlertDialog.Popup className={styles.Popup}>
            <div className={styles.Intro}>
              <AlertDialog.Title className={styles.Title}>Discard draft?</AlertDialog.Title>
              <AlertDialog.Description className={styles.Description}>
                This action cannot be undone.
              </AlertDialog.Description>
            </div>
            <div className={styles.Actions}>
              <AlertDialog.Close className={styles.Button}>Cancel</AlertDialog.Close>
              <AlertDialog.Close className={`${styles.Button} ${styles.DangerButton}`}>
                Discard
              </AlertDialog.Close>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </React.Fragment>
  );
}
