'use client';
import * as React from 'react';
import { Tooltip } from '@base-ui/react/tooltip';
import styles from '../../index.module.css';

const demoTooltip = Tooltip.createHandle();

export default function TooltipDetachedTriggersSimpleDemo() {
  return (
    <Tooltip.Provider>
      <Tooltip.Trigger className={styles.IconButton} handle={demoTooltip} aria-label="Delete">
        <TrashIcon aria-hidden="true" />
      </Tooltip.Trigger>

      <Tooltip.Root handle={demoTooltip}>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={11}>
            <Tooltip.Popup className={styles.Popup}>
              <Tooltip.Arrow className={styles.Arrow} />
              Delete
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
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
