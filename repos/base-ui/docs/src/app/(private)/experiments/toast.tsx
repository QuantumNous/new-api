'use client';
import { Toast } from '@base-ui/react/toast';
import styles from './toast.module.css';

const globalToastManager = Toast.createToastManager();

function showGlobalToast() {
  globalToastManager.promise(fetchUserData(), {
    error: 'Failed to fetch user data',
    success: 'User data loaded!',
    loading: 'Fetching user data…',
  });
}

function fetchUserData() {
  return new Promise((resolve, reject) => {
    // Simulate API call with a 50% chance of success
    setTimeout(() => {
      const success = Math.random() > 0.5;
      if (success) {
        resolve({ name: 'John Doe', email: 'john@example.com' });
      } else {
        reject(new Error('Failed to fetch user data'));
      }
    }, 1000);
  });
}

export default function Page() {
  return (
    <Toast.Provider toastManager={globalToastManager}>
      <Toast.Viewport className={styles.viewport}>
        <Toasts />
      </Toast.Viewport>
      <ToastButtons />
    </Toast.Provider>
  );
}

function ToastButtons() {
  const toastManager = Toast.useToastManager();

  function showRegularToast() {
    toastManager.add({
      title: 'Toast created',
      description: 'This is a toast.',
    });
  }

  function showActionToast() {
    toastManager.add({
      type: 'undo',
      title: 'Message deleted',
    });
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        display: 'flex',
        gap: 10,
        justifyContent: 'center',
      }}
    >
      <button className={styles.button} type="button" onClick={showRegularToast}>
        Show regular toast
      </button>
      <button className={styles.button} type="button" onClick={showActionToast}>
        Show action toast
      </button>
      <button className={styles.button} type="button" onClick={showGlobalToast}>
        Show global toast
      </button>
      <ToastPromiseExample />
    </div>
  );
}

function Toasts() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => (
    <Toast.Root key={toast.id} toast={toast} className={styles.root}>
      <Toast.Content className={styles.content}>
        <Toast.Title />
        <Toast.Description />
        {toast.type === 'undo' && (
          <button className={styles.button} type="button" onClick={() => alert('Action undone')}>
            Undo
          </button>
        )}
        <Toast.Close className={styles.close} aria-label="Close">
          x
        </Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ));
}

function ToastPromiseExample() {
  const toastManager = Toast.useToastManager();

  const handlePromiseClick = () => {
    toastManager
      .promise(fetchUserData(), {
        loading: 'Fetching user data…',
        success: 'User data loaded!',
        error: 'Failed to load user data',
      })
      .then((data) => {
        console.log('User data:', data);
      })
      .catch((err) => {
        console.error('Error handled:', err);
      });
  };

  return (
    <button className={styles.button} type="button" onClick={handlePromiseClick}>
      Show promise toast
    </button>
  );
}
