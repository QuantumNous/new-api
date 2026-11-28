import * as React from 'react';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import styles from './Radio.module.css';

export default function ExampleRadioGroup() {
  return (
    <RadioGroup aria-labelledby="apples-caption" defaultValue="fuji-apple" className={styles.Root}>
      <div className={styles.Caption} id="apples-caption">
        Best apple
      </div>

      <label className={styles.Label}>
        <Radio.Root data-testid="one" value="fuji-apple" className={styles.RadioRoot}>
          <Radio.Indicator className={styles.Indicator} />
        </Radio.Root>
        Fuji
      </label>

      <label className={styles.Label}>
        <Radio.Root data-testid="two" value="gala-apple" className={styles.RadioRoot}>
          <Radio.Indicator className={styles.Indicator} />
        </Radio.Root>
        Gala
      </label>

      <label className={styles.Label}>
        <Radio.Root data-testid="three" value="granny-smith-apple" className={styles.RadioRoot}>
          <Radio.Indicator className={styles.Indicator} />
        </Radio.Root>
        Granny Smith
      </label>
    </RadioGroup>
  );
}
