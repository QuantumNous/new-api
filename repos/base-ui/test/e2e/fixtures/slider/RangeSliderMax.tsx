import * as React from 'react';
import { Slider } from '@base-ui/react/slider';
import styles from './RangeSliderMax.module.css';

export default function RangeSliderMax() {
  return (
    <Slider.Root defaultValue={[100, 100]}>
      <Slider.Control className={styles.Control}>
        <Slider.Thumb index={0} className={styles.ThumbRed} />
        <Slider.Thumb index={1} className={styles.ThumbBlue} />
      </Slider.Control>
      <Slider.Value data-testid="output" />
    </Slider.Root>
  );
}
