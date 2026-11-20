'use client';
import * as React from 'react';
import { Dialog } from '@base-ui/react/dialog';
import styles from '../../_index.module.css';

const demoDialog = Dialog.createHandle<number>();

export default function DialogDetachedTriggersControlledDemo() {
  const [open, setOpen] = React.useState(false);
  const [triggerId, setTriggerId] = React.useState<string | null>(null);

  const handleOpenChange = (isOpen: boolean, eventDetails: Dialog.Root.ChangeEventDetails) => {
    setOpen(isOpen);
    setTriggerId(eventDetails.trigger?.id ?? null);
  };

  return (
    <React.Fragment>
      <div className={styles.Container}>
        <Dialog.Trigger className={styles.Button} handle={demoDialog} id="trigger-1" payload={1}>
          Open 1
        </Dialog.Trigger>

        <Dialog.Trigger className={styles.Button} handle={demoDialog} id="trigger-2" payload={2}>
          Open 2
        </Dialog.Trigger>

        <Dialog.Trigger className={styles.Button} handle={demoDialog} id="trigger-3" payload={3}>
          Open 3
        </Dialog.Trigger>

        <button
          className={styles.Button}
          type="button"
          onClick={() => {
            setTriggerId('trigger-2');
            setOpen(true);
          }}
        >
          Open programmatically
        </button>
      </div>

      <Dialog.Root
        handle={demoDialog}
        open={open}
        onOpenChange={handleOpenChange}
        triggerId={triggerId}
      >
        {({ payload }) => (
          <Dialog.Portal>
            <Dialog.Backdrop className={styles.Backdrop} />
            <Dialog.Popup className={styles.Popup}>
              {payload !== undefined && (
                <Dialog.Title className={styles.Title}>Dialog {payload}</Dialog.Title>
              )}
              <div className={styles.Actions}>
                <Dialog.Close className={styles.Button}>Close</Dialog.Close>
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        )}
      </Dialog.Root>
    </React.Fragment>
  );
}
