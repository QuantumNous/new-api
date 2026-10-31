import { Drawer } from '@base-ui/react/drawer';
import styles from './index.module.css';

export default function ExampleDrawer() {
  return (
    <Drawer.Root swipeDirection="right" modal={false} disablePointerDismissal>
      <Drawer.Trigger className={styles.Button}>Open non-modal drawer</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Viewport className={styles.Viewport}>
          <Drawer.Popup className={styles.Popup}>
            <Drawer.Content className={styles.Content}>
              <Drawer.Title className={styles.Title}>Non-modal drawer</Drawer.Title>
              <Drawer.Description className={styles.Description}>
                This drawer does not trap focus and ignores outside clicks. Use the close button or
                swipe to dismiss it.
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
