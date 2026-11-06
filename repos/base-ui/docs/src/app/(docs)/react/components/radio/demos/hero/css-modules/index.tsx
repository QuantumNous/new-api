'use client';
import * as React from 'react';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import styles from './index.module.css';

export default function ExampleRadioGroup() {
  const id = React.useId();
  return (
    <RadioGroup aria-labelledby={id} defaultValue="fuji-apple" className={styles.RadioGroup}>
      <div className={styles.Caption} id={id}>
        Best apple
      </div>

      <label className={styles.Item}>
        <Radio.Root value="fuji-apple" className={styles.Radio}>
          <Radio.Indicator className={styles.Indicator} />
        </Radio.Root>
        Fuji
      </label>

      <label className={styles.Item}>
        <Radio.Root value="gala-apple" className={styles.Radio}>
          <Radio.Indicator className={styles.Indicator} />
        </Radio.Root>
        Gala
      </label>

      <label className={styles.Item}>
        <Radio.Root value="granny-smith-apple" className={styles.Radio}>
          <Radio.Indicator className={styles.Indicator} />
        </Radio.Root>
        Granny Smith
      </label>
    </RadioGroup>
  );
}
