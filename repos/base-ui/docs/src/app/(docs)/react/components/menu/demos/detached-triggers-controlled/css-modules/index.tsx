'use client';
import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import styles from '../../_index.module.css';

/* eslint-disable no-console */
const itemGroups = {
  library: [
    { label: 'Add to library', onClick: () => console.log('Adding to library') },
    { label: 'Add to favorites', onClick: () => console.log('Adding to favorites') },
  ],
  playback: [
    { label: 'Play', onClick: () => console.log('Playing') },
    { label: 'Add to queue', onClick: () => console.log('Adding to queue') },
  ],
  share: [
    { label: 'Share', onClick: () => console.log('Sharing') },
    { label: 'Copy link', onClick: () => console.log('Copying link') },
  ],
} as const;
/* eslint-enable no-console */

type MenuKey = keyof typeof itemGroups;

const demoMenu = Menu.createHandle<MenuKey>();

export default function MenuDetachedTriggersControlledDemo() {
  const [open, setOpen] = React.useState(false);
  const [activeTrigger, setActiveTrigger] = React.useState<string | null>(null);

  const handleOpenChange = (isOpen: boolean, eventDetails: Menu.Root.ChangeEventDetails) => {
    setOpen(isOpen);
    if (isOpen) {
      setActiveTrigger(eventDetails.trigger?.id ?? null);
    }
  };

  return (
    <React.Fragment>
      <div className={styles.Container}>
        <Menu.Trigger
          className={styles.Button}
          handle={demoMenu}
          id="menu-trigger-1"
          payload="library"
        >
          Library
        </Menu.Trigger>

        <Menu.Trigger
          className={styles.Button}
          handle={demoMenu}
          id="menu-trigger-2"
          payload="playback"
        >
          Playback
        </Menu.Trigger>

        <Menu.Trigger
          className={styles.Button}
          handle={demoMenu}
          id="menu-trigger-3"
          payload="share"
        >
          Share
        </Menu.Trigger>

        <button
          type="button"
          className={styles.Button}
          onClick={() => {
            setActiveTrigger('menu-trigger-2');
            setOpen(true);
          }}
        >
          Open playback (controlled)
        </button>
      </div>

      <Menu.Root
        handle={demoMenu}
        open={open}
        triggerId={activeTrigger}
        onOpenChange={handleOpenChange}
      >
        {({ payload }) => (
          <Menu.Portal>
            <Menu.Positioner className={styles.Positioner} sideOffset={8}>
              <Menu.Popup className={styles.Popup}>
                {payload &&
                  itemGroups[payload].map((item, index) => (
                    <Menu.Item key={index} className={styles.Item} onClick={item.onClick}>
                      {item.label}
                    </Menu.Item>
                  ))}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        )}
      </Menu.Root>
    </React.Fragment>
  );
}
