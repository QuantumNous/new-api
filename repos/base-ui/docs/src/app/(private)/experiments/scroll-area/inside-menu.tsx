'use client';

import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import { ScrollArea } from '@base-ui/react/scroll-area';
import styles from './inside-menu.module.css';

export default function ExampleMenu() {
  return (
    <Menu.Root>
      <Menu.Trigger className={styles.Button}>
        Song <ChevronDownIcon className={styles.ButtonIcon} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className={styles.Positioner} sideOffset={8}>
          <Menu.Popup className={styles.Popup}>
            <Menu.Arrow className={styles.Arrow}>
              <ArrowSvg />
            </Menu.Arrow>
            <ScrollArea.Root className={styles.ScrollArea}>
              <ScrollArea.Viewport className={styles.Viewport} tabIndex={-1}>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger className={styles.SubmenuTrigger}>
                    Submenu
                    <ChevronRightIcon />
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner className={styles.Positioner} alignOffset={-4} sideOffset={-4}>
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

                {Array.from({ length: 100 }, (_, i) => (
                  <Menu.Item className={styles.Item} key={`random-item-${i + 1}`}>
                    Item {i + 1}
                  </Menu.Item>
                ))}
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar className={styles.Scrollbar}>
                <ScrollArea.Thumb className={styles.Thumb} />
              </ScrollArea.Scrollbar>
            </ScrollArea.Root>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function ArrowSvg(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...props}>
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        className={styles.ArrowFill}
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        className={styles.ArrowOuterStroke}
      />
      <path
        d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
        className={styles.ArrowInnerStroke}
      />
    </svg>
  );
}

function ChevronDownIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" {...props}>
      <path d="M1 3.5L5 7.5L9 3.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ChevronRightIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" {...props}>
      <path d="M3.5 9L7.5 5L3.5 1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
