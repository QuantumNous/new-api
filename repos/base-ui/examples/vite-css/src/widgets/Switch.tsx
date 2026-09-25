import { Switch as BaseSwitch } from '@base-ui/react/switch';
import clsx from 'clsx';
import styles from './Switch.module.css';

export function Switch(props: SwitchProps) {
  return (
    <BaseSwitch.Root {...props} className={clsx(styles.Switch, props.className)}>
      <BaseSwitch.Thumb className={styles.Thumb} />
    </BaseSwitch.Root>
  );
}

export type SwitchProps = BaseSwitch.Root.Props;
