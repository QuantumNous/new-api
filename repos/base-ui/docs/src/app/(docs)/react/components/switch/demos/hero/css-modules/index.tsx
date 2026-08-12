import { Switch } from '@base-ui/react/switch';
import styles from './index.module.css';

export default function ExampleSwitch() {
  return (
    <label className={styles.Label}>
      <Switch.Root defaultChecked className={styles.Switch}>
        <Switch.Thumb className={styles.Thumb} />
      </Switch.Root>
      Notifications
    </label>
  );
}
