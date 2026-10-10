import { Dialog } from '@base-ui/react/dialog';
import styles from './mobile-scroll-lock.module.css';

export default function ExampleDialog() {
  return (
    <div style={{ height: 2000 }}>
      <Dialog.Root>
        <Dialog.Trigger className={styles.Button} style={{ marginTop: 500 }}>
          View notifications
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className={styles.Backdrop} />
          <Dialog.Popup className={styles.Popup}>
            <textarea placeholder="What's on your mind?" style={{ width: '100%', height: 300 }} />
            <div className={styles.Actions}>
              <Dialog.Close className={styles.Button}>Close</Dialog.Close>
            </div>
            <Dialog.Root>
              <Dialog.Trigger className={styles.Button}>View notifications</Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Backdrop className={styles.Backdrop} />
                <Dialog.Popup className={styles.Popup}>
                  <textarea
                    placeholder="What's on your mind?"
                    style={{ width: '100%', height: 300 }}
                  />
                  <div className={styles.Actions}>
                    <Dialog.Close className={styles.Button}>Close</Dialog.Close>
                  </div>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
