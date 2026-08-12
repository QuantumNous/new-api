import { ContextMenu } from '@base-ui/react/context-menu';
import styles from './index.module.css';

export default function ExampleMenu() {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger className={styles.Trigger}>Right click here</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner className={styles.Positioner}>
          <ContextMenu.Popup className={styles.Popup}>
            <ContextMenu.Item className={styles.Item}>Add to Library</ContextMenu.Item>
            <ContextMenu.Item className={styles.Item}>Add to Playlist</ContextMenu.Item>
            <ContextMenu.Separator className={styles.Separator} />
            <ContextMenu.Item className={styles.Item}>Play Next</ContextMenu.Item>
            <ContextMenu.Item className={styles.Item}>Play Last</ContextMenu.Item>
            <ContextMenu.Separator className={styles.Separator} />
            <ContextMenu.Item className={styles.Item}>Favorite</ContextMenu.Item>
            <ContextMenu.Item className={styles.Item}>Share</ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
