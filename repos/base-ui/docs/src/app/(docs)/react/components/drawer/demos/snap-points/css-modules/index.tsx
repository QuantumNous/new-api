'use client';
import * as React from 'react';
import { Drawer } from '@base-ui/react/drawer';
import styles from './index.module.css';

const TOP_MARGIN_REM = 1;
const VISIBLE_SNAP_POINTS_REM = [30];

function toViewportSnapPoint(heightRem: number) {
  return `${heightRem + TOP_MARGIN_REM}rem`;
}

const snapPoints = [...VISIBLE_SNAP_POINTS_REM.map(toViewportSnapPoint), 1];

export default function ExampleDrawerSnapPoints() {
  return (
    <Drawer.Root snapPoints={snapPoints}>
      <Drawer.Trigger className={styles.Button}>Open snap drawer</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop className={styles.Backdrop} />
        <Drawer.Viewport className={styles.Viewport}>
          <Drawer.Popup
            className={styles.Popup}
            style={{ '--top-margin': `${TOP_MARGIN_REM}rem` } as React.CSSProperties}
          >
            <div className={styles.DragArea}>
              <div className={styles.Handle} />
              <Drawer.Title className={styles.Title}>Snap points</Drawer.Title>
            </div>
            <Drawer.Content className={styles.Scroll}>
              <div className={styles.Content}>
                <Drawer.Description className={styles.Description}>
                  Drag the sheet to snap between a compact peek and a near full-height view.
                </Drawer.Description>
                <div className={styles.Cards} aria-hidden>
                  {Array.from({ length: 20 }, (_, index) => (
                    <div className={styles.Card} key={index} />
                  ))}
                </div>
                <div className={styles.Actions}>
                  <Drawer.Close className={styles.Button}>Close</Drawer.Close>
                </div>
              </div>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
