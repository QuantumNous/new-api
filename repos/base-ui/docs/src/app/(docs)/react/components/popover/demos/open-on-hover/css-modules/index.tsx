import * as React from 'react';
import { Popover } from '@base-ui/react/popover';
import styles from '../../_index.module.css';

export default function ExamplePopover() {
  return (
    <Popover.Root>
      <Popover.Trigger openOnHover className={styles.Button}>
        Notifications
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8}>
          <Popover.Popup className={styles.Popup}>
            <Popover.Arrow className={styles.Arrow} />
            <Popover.Title className={styles.Title}>Notifications</Popover.Title>
            <Popover.Description className={styles.Description}>
              You are all caught up. Good job!
            </Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
