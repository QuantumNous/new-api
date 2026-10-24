'use client';
import * as React from 'react';
import { Drawer } from '@base-ui/react/drawer';
import styles from './index.module.css';

export default function ExampleDrawerSwipeArea() {
  const [portalContainer, setPortalContainer] = React.useState<HTMLDivElement | null>(null);

  return (
    <div className={styles.Root} ref={setPortalContainer}>
      <Drawer.Root swipeDirection="right" modal={false}>
        <Drawer.SwipeArea className={styles.SwipeArea}>
          <span className={styles.SwipeLabel}>Swipe here</span>
        </Drawer.SwipeArea>
        <div className={styles.Center}>
          <div className={styles.Instructions}>
            <p className={styles.Hint}>Swipe from the right edge to open the drawer.</p>
          </div>
        </div>
        <Drawer.Portal container={portalContainer}>
          <Drawer.Backdrop className={styles.Backdrop} />
          <Drawer.Viewport className={styles.Viewport}>
            <Drawer.Popup className={styles.Popup}>
              <Drawer.Content className={styles.Content}>
                <Drawer.Title className={styles.Title}>Library</Drawer.Title>
                <Drawer.Description className={styles.Description}>
                  Swipe from the edge whenever you want to jump back into your playlists.
                </Drawer.Description>
                <div className={styles.Actions}>
                  <Drawer.Close className={styles.Button}>Close</Drawer.Close>
                </div>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
