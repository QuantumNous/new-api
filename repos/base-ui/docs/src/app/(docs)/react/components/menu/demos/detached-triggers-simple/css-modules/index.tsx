'use client';
import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import styles from '../../_index.module.css';

const demoMenu = Menu.createHandle();

export default function MenuDetachedTriggersSimpleDemo() {
  return (
    <React.Fragment>
      <Menu.Trigger className={styles.IconButton} handle={demoMenu} aria-label="Project actions">
        <EllipsisHorizontalIcon />
      </Menu.Trigger>

      <Menu.Root handle={demoMenu}>
        <Menu.Portal>
          <Menu.Positioner sideOffset={8} className={styles.Positioner}>
            <Menu.Popup className={styles.Popup}>
              <Menu.Item className={styles.Item}>Rename</Menu.Item>
              <Menu.Item className={styles.Item}>Duplicate</Menu.Item>
              <Menu.Item className={styles.Item}>Move to folder</Menu.Item>
              <Menu.Separator className={styles.Separator} />
              <Menu.Item className={styles.Item}>Archive</Menu.Item>
              <Menu.Item className={styles.Item}>Delete</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </React.Fragment>
  );
}

function EllipsisHorizontalIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <circle cx="3" cy="8" r="1" />
      <circle cx="8" cy="8" r="1" />
      <circle cx="13" cy="8" r="1" />
    </svg>
  );
}
