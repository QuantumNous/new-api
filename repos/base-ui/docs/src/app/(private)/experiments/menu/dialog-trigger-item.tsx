'use client';
import * as React from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Menu } from '@base-ui/react/menu';
import dialogStyles from 'docs/src/app/(docs)/react/components/dialog/demos/hero/css-modules/index.module.css';
import styles from './menu.module.css';

export default function MenuDialogTriggerItemExperiment() {
  return (
    <div className={styles.ExperimentRoot}>
      <h1 className={styles.ExperimentTitle}>Menu dialog trigger item</h1>
      <p className={styles.ExperimentDescription}>
        Open the menu, then choose each Dialog.Trigger composition pattern.
      </p>

      <Menu.Root>
        <Menu.Trigger className={styles.Button}>
          Account
          <ChevronDownIcon className={styles.ButtonIcon} />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner className={styles.Positioner} sideOffset={8}>
            <Menu.Popup className={styles.Popup}>
              <Menu.Arrow className={styles.Arrow}>
                <ArrowSvg />
              </Menu.Arrow>
              <Menu.Item className={styles.Item}>View profile</Menu.Item>
              <Menu.Item className={styles.Item}>Copy profile link</Menu.Item>
              <Menu.Separator className={styles.Separator} />
              <Dialog.Root>
                <Menu.Item
                  className={styles.Item}
                  closeOnClick={false}
                  render={<Dialog.Trigger render={<div />} nativeButton={false} />}
                >
                  1. Menu.Item to Dialog.Trigger to div
                </Menu.Item>
                <DialogContent title="Menu.Item to Dialog.Trigger to div" />
              </Dialog.Root>

              <Dialog.Root>
                <Menu.Item
                  className={styles.Item}
                  closeOnClick={false}
                  nativeButton
                  render={<Dialog.Trigger />}
                >
                  2. Menu.Item to Dialog.Trigger button
                </Menu.Item>
                <DialogContent title="Menu.Item to Dialog.Trigger button" />
              </Dialog.Root>

              <Dialog.Root>
                <Dialog.Trigger
                  nativeButton={false}
                  render={<Menu.Item className={styles.Item} closeOnClick={false} />}
                >
                  3. Dialog.Trigger to Menu.Item div
                </Dialog.Trigger>
                <DialogContent title="Dialog.Trigger to Menu.Item div" />
              </Dialog.Root>

              <Dialog.Root>
                <Dialog.Trigger
                  render={
                    <Menu.Item
                      className={styles.Item}
                      closeOnClick={false}
                      nativeButton
                      render={
                        <button type="button" aria-label="Open Dialog.Trigger button pattern" />
                      }
                    />
                  }
                >
                  4. Dialog.Trigger to Menu.Item to button
                </Dialog.Trigger>
                <DialogContent title="Dialog.Trigger to Menu.Item to button" />
              </Dialog.Root>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}

function DialogContent(props: { title: string }) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className={dialogStyles.Backdrop} />
      <Dialog.Popup className={dialogStyles.Popup}>
        <Dialog.Title className={dialogStyles.Title}>{props.title}</Dialog.Title>
        <Dialog.Description className={dialogStyles.Description}>
          This dialog was opened from a menu item composed with Dialog.Trigger.
        </Dialog.Description>
        <div className={dialogStyles.Actions}>
          <Dialog.Close className={dialogStyles.Button}>Close</Dialog.Close>
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
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
