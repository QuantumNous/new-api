import * as React from 'react';
import { Slider } from '@base-ui/react/slider';
import styles from './Range.module.css';

export default function RangeSlider() {
  return (
    <Slider.Root defaultValue={[25, 30]}>
      <Slider.Control className={styles.Control}>
        <Slider.Thumb index={0} className={styles.ThumbRed} />
        <Slider.Thumb index={1} className={styles.ThumbBlue} />
      </Slider.Control>
      <Slider.Value data-testid="output" />
    </Slider.Root>
  );
}
