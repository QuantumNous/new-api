import { Field } from '@base-ui/react/field';
import { Fieldset } from '@base-ui/react/fieldset';
import styles from './index.module.css';

export default function ExampleField() {
  return (
    <Fieldset.Root className={styles.Fieldset}>
      <Fieldset.Legend className={styles.Legend}>Billing details</Fieldset.Legend>

      <Field.Root className={styles.Field}>
        <Field.Label className={styles.Label}>Company</Field.Label>
        <Field.Control placeholder="Enter company name" className={styles.Input} />
      </Field.Root>

      <Field.Root className={styles.Field}>
        <Field.Label className={styles.Label}>Tax ID</Field.Label>
        <Field.Control placeholder="Enter fiscal number" className={styles.Input} />
      </Field.Root>
    </Fieldset.Root>
  );
}
