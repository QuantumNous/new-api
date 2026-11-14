'use client';
import * as React from 'react';
import { Toast } from '@base-ui/react/toast';
import { Button } from '@base-ui/react/button';
import { Tooltip } from '@base-ui/react/tooltip';
import styles from './index.module.css';

const anchoredToastManager = Toast.createToastManager();
const stackedToastManager = Toast.createToastManager();

export default function ExampleToast() {
  return (
    <Tooltip.Provider>
      <Toast.Provider toastManager={anchoredToastManager}>
        <AnchoredToasts />
      </Toast.Provider>
      <Toast.Provider toastManager={stackedToastManager}>
        <StackedToasts />
      </Toast.Provider>

      <div className={styles.ButtonGroup}>
        <CopyButton />
        <StackedToastButton />
      </div>
    </Tooltip.Provider>
  );
}

function StackedToastButton() {
  function createToast() {
    stackedToastManager.add({
      description: 'Copied',
    });
  }

  return (
    <button type="button" className={styles.Button} onClick={createToast}>
      Stacked toast
    </button>
  );
}

function CopyButton() {
  const [copied, setCopied] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);

  function handleCopy() {
    setCopied(true);

    anchoredToastManager.add({
      description: 'Copied',
      positionerProps: {
        anchor: buttonRef.current,
        sideOffset: 10,
      },
      timeout: 1500,
      onClose() {
        setCopied(false);
      },
    });
  }

  return (
    <Tooltip.Root disabled={copied}>
      <Tooltip.Trigger
        ref={buttonRef}
        closeOnClick={false}
        className={styles.CopyButton}
        onClick={handleCopy}
        aria-label="Copy to clipboard"
        render={<Button disabled={copied} focusableWhenDisabled />}
      >
        {copied ? <CheckIcon /> : <ClipboardIcon />}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={10}>
          <Tooltip.Popup className={styles.Tooltip}>
            <Tooltip.Arrow className={styles.Arrow} />
            Copy
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function AnchoredToasts() {
  const { toasts } = Toast.useToastManager();
  return (
    <Toast.Portal>
      <Toast.Viewport className={styles.AnchoredViewport}>
        {toasts.map((toast) => (
          <Toast.Positioner key={toast.id} toast={toast} className={styles.AnchoredPositioner}>
            <Toast.Root toast={toast} className={styles.AnchoredToast}>
              <Toast.Arrow className={styles.Arrow} />
              <Toast.Content>
                <Toast.Description className={styles.AnchoredDescription} />
              </Toast.Content>
            </Toast.Root>
          </Toast.Positioner>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

function StackedToasts() {
  const { toasts } = Toast.useToastManager();
  return (
    <Toast.Portal>
      <Toast.Viewport className={styles.StackedViewport}>
        {toasts.map((toast) => (
          <Toast.Root key={toast.id} toast={toast} className={styles.StackedToast}>
            <Toast.Content className={styles.Content}>
              <div className={styles.Text}>
                <Toast.Title className={styles.Title} />
                <Toast.Description className={styles.Description} />
              </div>
              <Toast.Close className={styles.Close}>Dismiss</Toast.Close>
            </Toast.Content>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

function ClipboardIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

function CheckIcon(props: React.ComponentProps<'svg'>) {
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
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}
