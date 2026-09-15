import { Slider } from '@base-ui/react/slider';
import styles from './index.module.css';

export default function RangeSlider() {
  return (
    <Slider.Root defaultValue={[25, 45]}>
      <Slider.Control className={styles.Control}>
        <Slider.Track className={styles.Track}>
          <Slider.Indicator className={styles.Indicator} />
          <Slider.Thumb index={0} aria-label="Minimum value" className={styles.Thumb} />
          <Slider.Thumb index={1} aria-label="Maximum value" className={styles.Thumb} />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}
