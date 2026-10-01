'use client';
import * as React from 'react';
import { Popover } from '@base-ui/react/popover';
import styles from '../../_index.module.css';

const demoPopover = Popover.createHandle();

export default function PopoverDetachedTriggersSimpleDemo() {
  return (
    <React.Fragment>
      <Popover.Trigger className={styles.Button} handle={demoPopover}>
        Notifications
      </Popover.Trigger>

      <Popover.Root handle={demoPopover}>
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
    </React.Fragment>
  );
}
