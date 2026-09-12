'use client';
import { ScrollArea } from '@base-ui/react/scroll-area';
import styles from './scroll-area.module.css';

export default function ScrollAreaIntroduction() {
  return (
    <ScrollArea.Root className={styles.ScrollAreaRoot}>
      <ScrollArea.Viewport className={styles.ScrollAreaViewport}>
        <div
          style={{
            width: 1000,
            height: 1000,
            background: 'linear-gradient(to bottom, red, white)',
          }}
        />
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar className={styles.ScrollAreaScrollbar}>
        <ScrollArea.Thumb className={styles.ScrollAreaThumb} />
      </ScrollArea.Scrollbar>
      <ScrollArea.Scrollbar orientation="horizontal" className={styles.ScrollAreaScrollbar}>
        <ScrollArea.Thumb className={styles.ScrollAreaThumb} />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
}
