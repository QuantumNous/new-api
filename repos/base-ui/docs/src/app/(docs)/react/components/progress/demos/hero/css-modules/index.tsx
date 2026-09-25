'use client';
import * as React from 'react';
import { Progress } from '@base-ui/react/progress';
import styles from './index.module.css';

export default function ExampleProgress() {
  const [value, setValue] = React.useState(20);

  // Simulate changes
  React.useEffect(() => {
    const interval = setInterval(() => {
      setValue((current) => Math.min(100, Math.round(current + Math.random() * 25)));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Progress.Root className={styles.Progress} value={value}>
      <Progress.Label className={styles.Label}>Export data</Progress.Label>
      <Progress.Value className={styles.Value} />
      <Progress.Track className={styles.Track}>
        <Progress.Indicator className={styles.Indicator} />
      </Progress.Track>
    </Progress.Root>
  );
}
