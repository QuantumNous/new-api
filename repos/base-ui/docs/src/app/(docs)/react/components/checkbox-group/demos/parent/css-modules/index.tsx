'use client';
import * as React from 'react';
import { Checkbox } from '@base-ui/react/checkbox';
import { CheckboxGroup } from '@base-ui/react/checkbox-group';
import styles from './index.module.css';

const fruits = ['fuji-apple', 'gala-apple', 'granny-smith-apple'];

export default function ExampleCheckboxGroup() {
  const id = React.useId();
  const [value, setValue] = React.useState<string[]>([]);

  return (
    <CheckboxGroup
      aria-labelledby={id}
      value={value}
      onValueChange={setValue}
      allValues={fruits}
      className={styles.CheckboxGroup}
      style={{ marginLeft: '1rem' }}
    >
      <label className={styles.Item} id={id} style={{ marginLeft: '-1rem' }}>
        <Checkbox.Root className={styles.Checkbox} parent>
          <Checkbox.Indicator
            className={styles.Indicator}
            render={(props, state) => (
              <span {...props}>{state.indeterminate ? <HorizontalRuleIcon /> : <CheckIcon />}</span>
            )}
          />
        </Checkbox.Root>
        Apples
      </label>

      <label className={styles.Item}>
        <Checkbox.Root value="fuji-apple" className={styles.Checkbox}>
          <Checkbox.Indicator className={styles.Indicator}>
            <CheckIcon />
          </Checkbox.Indicator>
        </Checkbox.Root>
        Fuji
      </label>

      <label className={styles.Item}>
        <Checkbox.Root value="gala-apple" className={styles.Checkbox}>
          <Checkbox.Indicator className={styles.Indicator}>
            <CheckIcon />
          </Checkbox.Indicator>
        </Checkbox.Root>
        Gala
      </label>

      <label className={styles.Item}>
        <Checkbox.Root value="granny-smith-apple" className={styles.Checkbox}>
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

function HorizontalRuleIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      strokeWidth={1}
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <line
        x1="3"
        y1="12"
        x2="21"
        y2="12"
        stroke="currentColor"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
