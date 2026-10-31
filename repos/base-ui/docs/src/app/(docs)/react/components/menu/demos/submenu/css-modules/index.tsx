'use client';
import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import styles from './index.module.css';

export default function ExampleMenu() {
  return (
    <Menu.Root>
      <Menu.Trigger className={styles.Button}>
        Song <CaretDownIcon />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className={styles.Positioner} sideOffset={8}>
          <Menu.Popup className={styles.Popup}>
            <Menu.Item className={styles.Item}>Add to Library</Menu.Item>

            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger className={styles.SubmenuTrigger}>
                Add to Playlist
                <CaretRightIcon />
              </Menu.SubmenuTrigger>
              <Menu.Portal>
                <Menu.Positioner
                  className={styles.Positioner}
                  sideOffset={getOffset}
                  alignOffset={getOffset}
                >
                  <Menu.Popup className={styles.Popup}>
                    <Menu.Item className={styles.Item}>Get Up!</Menu.Item>
                    <Menu.Item className={styles.Item}>Inside Out</Menu.Item>
                    <Menu.Item className={styles.Item}>Night Beats</Menu.Item>
                    <Menu.Separator className={styles.Separator} />
                    <Menu.Item className={styles.Item}>New playlist…</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>

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

function getOffset({ side }: { side: Menu.Positioner.Props['side'] }) {
  return side === 'top' || side === 'bottom' ? 4 : -4;
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

function CaretRightIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="M6 12V4l4.5 4z" />
    </svg>
  );
}
