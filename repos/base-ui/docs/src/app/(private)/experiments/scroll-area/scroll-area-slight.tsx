import { ScrollArea } from '@base-ui/react/scroll-area';
import styles from './scroll-area-slight.module.css';

export default function ScrollAreaSlight() {
  return (
    <ScrollArea.Root className={styles.ScrollArea}>
      <ScrollArea.Viewport className={styles.Viewport}>
        <div className={styles.Paragraph}>
          <div
            style={{
              height: 10,
              width: 350,
              background: 'linear-gradient(to right, red, orange)',
            }}
          />
        </div>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar className={styles.Scrollbar} orientation="horizontal">
        <ScrollArea.Thumb className={styles.Thumb} />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
}
