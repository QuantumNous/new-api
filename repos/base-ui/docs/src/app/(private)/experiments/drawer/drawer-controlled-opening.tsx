'use client';
import * as React from 'react';
import { Drawer } from '@base-ui/react/drawer';
import styles from './drawer-controlled-opening.module.css';

export default function ControlledOpening() {
  const [open, setOpen] = React.useState(false);
  const [locked, setLocked] = React.useState(false);
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (locked) {
          return;
        }
        setOpen(nextOpen);
      }}
    >
      <div className={styles.Row}>
        <Drawer.Trigger className={styles.Button}>Open bottom drawer</Drawer.Trigger>
        <label className={styles.CheckboxLabel}>
          <input
            type="checkbox"
            checked={locked}
            onChange={(event) => setLocked(event.target.checked)}
          />
          Lock open state
        </label>
      </div>
      <Drawer.Portal>
        <Drawer.Backdrop className={styles.Backdrop} />
        <Drawer.Viewport className={styles.Viewport}>
          <Drawer.Popup className={styles.Popup}>
            <div className={styles.Handle} />
            <Drawer.Content className={styles.Content}>
              <Drawer.Title className={styles.Title}>Notifications</Drawer.Title>
              <Drawer.Description className={styles.Description}>
                You are all caught up. Good job!
              </Drawer.Description>
              <div className={styles.Actions}>
                <Drawer.Close className={styles.Button}>Close</Drawer.Close>
              </div>
              <label className={styles.CheckboxLabelCentered}>
                <input
                  type="checkbox"
                  checked={locked}
                  onChange={(event) => setLocked(event.target.checked)}
                />
                Lock open state
              </label>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
