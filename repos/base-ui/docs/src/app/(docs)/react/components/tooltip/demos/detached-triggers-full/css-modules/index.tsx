'use client';
import * as React from 'react';
import { Tooltip } from '@base-ui/react/tooltip';
import styles from './index.module.css';

const demoTooltip = Tooltip.createHandle<React.ReactNode>();

export default function TooltipDetachedTriggersFullDemo() {
  return (
    <Tooltip.Provider>
      <div className={styles.ButtonGroup}>
        <Tooltip.Trigger
          className={styles.Button}
          handle={demoTooltip}
          payload="Listen to audio preview"
          aria-label="Listen to audio preview"
        >
          <HeadphonesIcon aria-hidden="true" />
        </Tooltip.Trigger>

        <Tooltip.Trigger
          className={styles.Button}
          handle={demoTooltip}
          payload="Set a timer"
          aria-label="Set a timer"
        >
          <StopwatchIcon aria-hidden="true" />
        </Tooltip.Trigger>

        <Tooltip.Trigger
          className={styles.Button}
          handle={demoTooltip}
          payload="Delete: This action cannot be undone"
          aria-label="Delete: This action cannot be undone"
        >
          <TrashIcon aria-hidden="true" />
        </Tooltip.Trigger>
      </div>

      <Tooltip.Root handle={demoTooltip}>
        {({ payload }) => (
          <Tooltip.Portal>
            <Tooltip.Positioner sideOffset={11} className={styles.Positioner}>
              <Tooltip.Popup className={styles.Popup}>
                <Tooltip.Arrow className={styles.Arrow} />

                <Tooltip.Viewport className={styles.Viewport}>{payload}</Tooltip.Viewport>
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        )}
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function HeadphonesIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path strokeLinecap="round" d="M1.5 11V7.5c0-2.5 2.5-6 6.5-6s6.5 3.5 6.5 6V11" />
      <path d="M12 7.5c1.3807 0 2.5 1.11929 2.5 2.5v2c0 1.3807-1.1193 2.5-2.5 2.5h-1.5v-7zm-8 0h1.5v7H4c-1.38071 0-2.5-1.1193-2.5-2.5v-2c0-1.38071 1.11929-2.5 2.5-2.5Z" />
    </svg>
  );
}

function StopwatchIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <circle cx="8" cy="8.5" r="6" />
      <path
        strokeLinecap="square"
        strokeLinejoin="round"
        d="M8 9.5v-5m0-2v-2m-2 0h4M12 4l1.5-1.5"
      />
    </svg>
  );
}

function TrashIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path strokeLinecap="square" d="M2.5 4h11" />
      <path strokeLinecap="round" d="M6.5 4V3c0-.82843.67157-1.5 1.5-1.5s1.5.67157 1.5 1.5v1" />
      <path
        strokeLinecap="square"
        d="m3.5 4 .87069 9.1422c.07332.7699.7199 1.3578 1.49324 1.3578h4.27217c.7733 0 1.4199-.5879 1.4932-1.3578L12.5 4"
      />
    </svg>
  );
}
