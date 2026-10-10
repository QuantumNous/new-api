import * as React from 'react';
import { Field } from '@base-ui/react/field';
import styles from './Input.module.css';

export default function InputValidateOnChange() {
  return (
    <Field.Root
      validationMode="onChange"
      validate={(val) => (val === 'abcd' ? 'custom error' : null)}
      className={styles.Root}
    >
      <Field.Control required minLength={3} defaultValue="" className={styles.Control} />
      <Field.Error data-testid="error" className={styles.Error} match="valueMissing">
        valueMissing error
      </Field.Error>
      <Field.Error data-testid="error" className={styles.Error} match="tooShort">
        tooShort error
      </Field.Error>
      <Field.Error data-testid="error" className={styles.Error} match="customError" />
    </Field.Root>
  );
}
