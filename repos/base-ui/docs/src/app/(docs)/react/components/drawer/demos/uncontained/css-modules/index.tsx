'use client';
import * as React from 'react';
import { Drawer } from '@base-ui/react/drawer';
import styles from './index.module.css';

const ACTIONS = ['Unfollow', 'Mute', 'Add to Favourites', 'Add to Close Friends', 'Restrict'];

export default function ExampleDrawerUncontained() {
  const [open, setOpen] = React.useState(false);

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger className={styles.Button}>Open action sheet</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop className={styles.Backdrop} />
        <Drawer.Viewport className={styles.Viewport}>
          <Drawer.Popup className={styles.Popup}>
            <Drawer.Content className={styles.Surface}>
              <Drawer.Title className={styles.VisuallyHidden}>Profile actions</Drawer.Title>
              <Drawer.Description className={styles.VisuallyHidden}>
                Choose an action for this user.
              </Drawer.Description>

              <ul className={styles.Actions} aria-label="Profile actions">
                {ACTIONS.map((action, index) => (
                  <li key={action} className={styles.Action}>
                    {index === 0 && (
                      <Drawer.Close className={styles.VisuallyHidden}>
                        Close action sheet
                      </Drawer.Close>
                    )}
                    <button
                      type="button"
                      className={styles.ActionButton}
                      onClick={() => setOpen(false)}
                    >
                      {action}
                    </button>
                  </li>
                ))}
              </ul>
            </Drawer.Content>
            <div className={styles.DangerSurface}>
              <button type="button" className={styles.DangerButton} onClick={() => setOpen(false)}>
                Block User
              </button>
            </div>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
