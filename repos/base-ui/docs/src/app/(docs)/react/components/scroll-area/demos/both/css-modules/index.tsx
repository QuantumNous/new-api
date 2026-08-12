import { ScrollArea } from '@base-ui/react/scroll-area';
import styles from './index.module.css';

export default function ExampleScrollAreaBoth() {
  return (
    <ScrollArea.Root className={styles.ScrollArea}>
      <ScrollArea.Viewport className={styles.Viewport}>
        <ScrollArea.Content className={styles.Content}>
          <ul className={styles.Grid}>
            {Array.from({ length: 100 }, (_, i) => (
              <li key={i} className={styles.Item}>
                {i + 1}
              </li>
            ))}
          </ul>
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar className={styles.Scrollbar}>
        <ScrollArea.Thumb className={styles.Thumb} />
      </ScrollArea.Scrollbar>
      <ScrollArea.Scrollbar className={styles.Scrollbar} orientation="horizontal">
        <ScrollArea.Thumb className={styles.Thumb} />
      </ScrollArea.Scrollbar>
      <ScrollArea.Corner />
    </ScrollArea.Root>
  );
}
