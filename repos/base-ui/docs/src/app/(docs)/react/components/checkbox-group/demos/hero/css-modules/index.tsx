'use client';
import * as React from 'react';
import { Checkbox } from '@base-ui/react/checkbox';
import { CheckboxGroup } from '@base-ui/react/checkbox-group';
import styles from './index.module.css';

export default function ExampleCheckboxGroup() {
  const id = React.useId();
  return (
    <CheckboxGroup
      aria-labelledby={id}
      defaultValue={['fuji-apple']}
      className={styles.CheckboxGroup}
    >
      <div className={styles.Caption} id={id}>
        Apples
      </div>

      <label className={styles.Item}>
        <Checkbox.Root name="apple" value="fuji-apple" className={styles.Checkbox}>
          <Checkbox.Indicator className={styles.Indicator}>
            <CheckIcon />
          </Checkbox.Indicator>
        </Checkbox.Root>
        Fuji
      </label>

      <label className={styles.Item}>
        <Checkbox.Root name="apple" value="gala-apple" className={styles.Checkbox}>
          <Checkbox.Indicator className={styles.Indicator}>
            <CheckIcon />
          </Checkbox.Indicator>
        </Checkbox.Root>
        Gala
      </label>

      <label className={styles.Item}>
        <Checkbox.Root name="apple" value="granny-smith-apple" className={styles.Checkbox}>
          <Checkbox.Indicator className={styles.Indicator}>
            <CheckIcon />
          </Checkbox.Indicator>
        </Checkbox.Root>
        Granny Smith
      </label>
    </CheckboxGroup>
  );
}

function CheckIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}
