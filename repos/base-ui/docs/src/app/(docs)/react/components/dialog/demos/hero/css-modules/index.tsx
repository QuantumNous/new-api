import { Dialog } from '@base-ui/react/dialog';
import styles from './index.module.css';

export default function ExampleDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger className={styles.Button}>View notifications</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.Backdrop} />
        <Dialog.Popup className={styles.Popup}>
          <div className={styles.Intro}>
            <Dialog.Title className={styles.Title}>Notifications</Dialog.Title>
            <Dialog.Description className={styles.Description}>
              You are all caught up. Good job!
            </Dialog.Description>
          </div>
          <div className={styles.Actions}>
            <Dialog.Close className={styles.Button}>Close</Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
