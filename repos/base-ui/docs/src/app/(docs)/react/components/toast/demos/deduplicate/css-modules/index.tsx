'use client';
import { Toast } from '@base-ui/react/toast';
import styles from './index.module.css';

export default function PulseToast() {
  return (
    <Toast.Provider>
      <PulseToastButton />
      <Toast.Portal>
        <Toast.Viewport className={styles.Viewport}>
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function PulseToastButton() {
  const toastManager = Toast.useToastManager();

  function createToast() {
    toastManager.add({
      id: 'save-status',
      title: 'Draft saved',
      description: 'Click again while it is visible to replay the pulse.',
    });
  }

  return (
    <button type="button" onClick={createToast} className={styles.Button}>
      Save draft
    </button>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => <PulseToastItem key={toast.id} toast={toast} />);
}

function PulseToastItem({ toast }: { toast: Toast.Root.ToastObject }) {
  let pulseClassName: string | null = null;

  // New toasts start with `updateKey: 0`, so the first add skips the replay pulse.
  if (toast.updateKey) {
    pulseClassName = toast.updateKey % 2 === 0 ? styles.PulseEven : styles.PulseOdd;
  }

  const className = [styles.Toast, pulseClassName].filter(Boolean).join(' ');

  return (
    <Toast.Root toast={toast} className={className}>
      <Toast.Content className={styles.Content}>
        <div className={styles.Text}>
          <Toast.Title className={styles.Title} />
          <Toast.Description className={styles.Description} />
        </div>
        <Toast.Close className={styles.Close}>Dismiss</Toast.Close>
      </Toast.Content>
    </Toast.Root>
  );
}
