'use client';
import * as React from 'react';
import { Popover } from '@base-ui/react/popover';
import { Avatar } from '@base-ui/react/avatar';
import baseStyles from '../../_index.module.css';
import styles from './index.module.css';

const demoPopover = Popover.createHandle<React.ComponentType>();

export default function PopoverDetachedTriggersFullDemo() {
  return (
    <div className={styles.Container}>
      <Popover.Trigger
        className={baseStyles.Button}
        handle={demoPopover}
        payload={NotificationsPanel}
      >
        Notifications
      </Popover.Trigger>

      <Popover.Trigger className={baseStyles.Button} handle={demoPopover} payload={ActivityPanel}>
        Activity
      </Popover.Trigger>

      <Popover.Trigger className={baseStyles.Button} handle={demoPopover} payload={ProfilePanel}>
        Profile
      </Popover.Trigger>

      <Popover.Root handle={demoPopover}>
        {({ payload: Payload }) => (
          <Popover.Portal>
            <Popover.Positioner sideOffset={8} className={styles.Positioner}>
              <Popover.Popup className={styles.Popup}>
                <Popover.Arrow className={styles.Arrow} />

                <Popover.Viewport className={styles.Viewport}>
                  {Payload !== undefined && <Payload />}
                </Popover.Viewport>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        )}
      </Popover.Root>
    </div>
  );
}

function NotificationsPanel() {
  return (
    <div className={styles.Stack}>
      <Popover.Title className={styles.Title}>Notifications</Popover.Title>
      <Popover.Description className={styles.Description}>
        You are all caught up. Good job!
      </Popover.Description>
    </div>
  );
}

function ProfilePanel() {
  return (
    <div className={styles.ProfilePanel}>
      <Popover.Title className={styles.Title}>Jason Eventon</Popover.Title>
      <Avatar.Root className={styles.Avatar}>
        <Avatar.Image
          src="https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?w=128&h=128&dpr=2&q=80"
          width="48"
          height="48"
          className={styles.AvatarImage}
        />
      </Avatar.Root>
      <span className={styles.Plan}>Pro plan</span>
      <div className={styles.ProfileActions}>
        <a href="#">Profile settings</a>
        <a href="#">Log out</a>
      </div>
    </div>
  );
}

function ActivityPanel() {
  return (
    <div className={styles.Stack}>
      <Popover.Title className={styles.Title}>Activity</Popover.Title>
      <Popover.Description className={styles.Description}>
        Nothing interesting happened recently.
      </Popover.Description>
    </div>
  );
}
