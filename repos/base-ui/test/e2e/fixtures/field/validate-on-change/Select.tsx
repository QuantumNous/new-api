import * as React from 'react';
import { Field } from '@base-ui/react/field';
import { Select } from '@base-ui/react/select';
import styles from './Select.module.css';

const items = [
  { label: 'select', value: null },
  { label: 'one', value: 'one' },
  { label: 'two', value: 'two' },
  { label: 'three', value: 'three' },
  { label: 'four', value: 'four' },
];

export default function SelectValidateOnChange() {
  return (
    <Field.Root
      validationMode="onChange"
      validate={(val) => {
        if (val === 'one') {
          return 'error one';
        }

        if (val === 'three') {
          return 'error three';
        }
        return null;
      }}
      className={styles.Root}
    >
      <Select.Root items={items} required>
        <Select.Trigger className={styles.Trigger}>
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner className={styles.Positioner} sideOffset={8}>
            <Select.Popup className={styles.Popup}>
              <Select.ScrollUpArrow className={`${styles.ScrollArrow} ${styles.ScrollUp}`} />
              <Select.List className={styles.List}>
                {items.map(({ label, value }) => (
                  <Select.Item key={label} value={value} className={styles.Item}>
                    <Select.ItemText>{label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.List>
              <Select.ScrollDownArrow className={`${styles.ScrollArrow} ${styles.ScrollDown}`} />
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      <Field.Error data-testid="error" className={styles.Error} match="valueMissing">
        valueMissing error
      </Field.Error>
      <Field.Error data-testid="error" className={styles.Error} match="customError" />
    </Field.Root>
  );
}
