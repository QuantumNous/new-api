'use client';
import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import styles from './index.module.css';

export default function MenuArrowDemo() {
  return (
    <Menu.Root>
      <Menu.Trigger className={styles.Button}>
        Song <CaretDownIcon />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          className={styles.Positioner}
          sideOffset={({ side }) => (side === 'top' ? 12 : 8)}
        >
          <Menu.Popup className={styles.Popup}>
            <Menu.Arrow className={styles.Arrow} />
            <Menu.Item className={styles.Item}>Add to Library</Menu.Item>
            <Menu.Item className={styles.Item}>Add to Playlist</Menu.Item>
            <Menu.Separator className={styles.Separator} />
            <Menu.Item className={styles.Item}>Play Next</Menu.Item>
            <Menu.Item className={styles.Item}>Play Last</Menu.Item>
            <Menu.Separator className={styles.Separator} />
            <Menu.Item className={styles.Item}>Favorite</Menu.Item>
            <Menu.Item className={styles.Item}>Share</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function CaretDownIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="M12 6H4l4 4.5z" />
    </svg>
  );
}
