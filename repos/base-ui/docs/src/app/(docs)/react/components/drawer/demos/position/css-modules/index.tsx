import { Drawer } from '@base-ui/react/drawer';
import styles from './index.module.css';

export default function ExampleDrawer() {
  return (
    <Drawer.Root>
      <Drawer.Trigger className={styles.Button}>Open bottom drawer</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop className={styles.Backdrop} />
        <Drawer.Viewport className={styles.Viewport}>
          <Drawer.Popup className={styles.Popup}>
            <div className={styles.Handle} />
            <Drawer.Content className={styles.Content}>
              <Drawer.Title className={styles.Title}>Notifications</Drawer.Title>
              <Drawer.Description className={styles.Description}>
                You are all caught up. Good job!
              </Drawer.Description>
              <div className={styles.Actions}>
                <Drawer.Close className={styles.Button}>Close</Drawer.Close>
              </div>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
