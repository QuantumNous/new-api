'use client';
import * as React from 'react';
import { Toast } from '@base-ui/react/toast';
import styles from './index.module.css';

export default function ExampleToast() {
  return (
    <Toast.Provider>
      <ToastButton />
      <Toast.Portal>
        <Toast.Viewport className={styles.Viewport}>
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastButton() {
  const toastManager = Toast.useToastManager();
  const [count, setCount] = React.useState(0);

  function createToast() {
    setCount((prev) => prev + 1);
    toastManager.add({
      title: `Toast ${count + 1} created`,
      description: 'This is a toast notification.',
    });
  }

  return (
    <button type="button" className={styles.Button} onClick={createToast}>
      Create toast
    </button>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => (
    <Toast.Root key={toast.id} toast={toast} swipeDirection="up" className={styles.Toast}>
      <Toast.Content className={styles.Content}>
        <div className={styles.Text}>
          <Toast.Title className={styles.Title} />
          <Toast.Description className={styles.Description} />
        </div>
        <Toast.Close className={styles.Close}>Dismiss</Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ));
}
