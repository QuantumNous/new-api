'use client';
import * as React from 'react';
import { Popover } from '@base-ui/react/popover';
import styles from 'docs/src/app/(docs)/react/components/popover/demos/detached-triggers-full/css-modules/index.module.css';
import localStyles from './dynamic-size.module.css';

const demoPopover = Popover.createHandle<number>();

export default function Experiment() {
  const [payload, setPayload] = React.useState(5);

  return (
    <div className={styles.Container}>
      <Popover.Trigger className={styles.IconButton} handle={demoPopover} payload={payload}>
        <BellIcon aria-label="Notifications" className={styles.Icon} />
      </Popover.Trigger>

      <Popover.Trigger className={styles.IconButton} handle={demoPopover} payload={5}>
        <BellIcon aria-label="Notifications" className={styles.Icon} />
      </Popover.Trigger>

      <Popover.Root handle={demoPopover}>
        {({ payload: paragraphCount }) => (
          <Popover.Portal>
            <Popover.Positioner sideOffset={8} className={styles.Positioner}>
              <Popover.Popup className={styles.Popup}>
                <Popover.Arrow className={styles.Arrow}>
                  <ArrowSvg />
                </Popover.Arrow>

                <Popover.Viewport className={styles.Viewport}>
                  <p>Popover</p>
                  <div className={localStyles.Controls}>
                    <button
                      type="button"
                      onClick={() => setPayload(10)}
                      className={localStyles.Button}
                    >
                      Grow
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayload(1)}
                      className={localStyles.Button}
                    >
                      Shrink
                    </button>
                  </div>
                  {Array.from({ length: paragraphCount ?? 0 }, (_, i) => i + 1).map((num) => (
                    <p key={num}>Item {num}</p>
                  ))}
                </Popover.Viewport>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        )}
      </Popover.Root>
    </div>
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

function BellIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg fill="currentColor" width="20" height="20" viewBox="0 0 16 16" {...props}>
      <path d="M 8 1 C 7.453125 1 7 1.453125 7 2 L 7 3.140625 C 5.28125 3.589844 4 5.144531 4 7 L 4 10.984375 C 4 10.984375 3.984375 11.261719 3.851563 11.519531 C 3.71875 11.78125 3.558594 12 3 12 L 3 13 L 13 13 L 13 12 C 12.40625 12 12.253906 11.78125 12.128906 11.53125 C 12.003906 11.277344 12 11.003906 12 11.003906 L 12 7 C 12 5.144531 10.71875 3.589844 9 3.140625 L 9 2 C 9 1.453125 8.546875 1 8 1 Z M 8 13 C 7.449219 13 7 13.449219 7 14 C 7 14.550781 7.449219 15 8 15 C 8.550781 15 9 14.550781 9 14 C 9 13.449219 8.550781 13 8 13 Z M 8 4 C 9.664063 4 11 5.335938 11 7 L 11 10.996094 C 11 10.996094 10.988281 11.472656 11.234375 11.96875 C 11.238281 11.980469 11.246094 11.988281 11.25 12 L 4.726563 12 C 4.730469 11.992188 4.738281 11.984375 4.742188 11.980469 C 4.992188 11.488281 5 11.015625 5 11.015625 L 5 7 C 5 5.335938 6.335938 4 8 4 Z" />
    </svg>
  );
}
