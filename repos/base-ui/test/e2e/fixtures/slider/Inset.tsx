import { Slider } from '@base-ui/react/slider';
import styles from './Inset.module.css';

export default function InsetSlider() {
  return (
    <Slider.Root thumbAlignment="edge" defaultValue={30}>
      <Slider.Control className={styles.Control}>
        <Slider.Thumb data-testid="thumb" className={styles.Thumb} />
      </Slider.Control>
      <Slider.Value data-testid="output" />
    </Slider.Root>
  );
}
