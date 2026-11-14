'use client';
import * as React from 'react';
import { Field } from '@base-ui/react/field';
import { Form } from '@base-ui/react/form';
import { Button } from '@base-ui/react/button';
import styles from './index.module.css';

interface FormState {
  serverErrors?: Form.Props['errors'];
}

export default function ActionStateForm() {
  const [state, formAction, loading] = React.useActionState<FormState, FormData>(submitForm, {});

  return (
    <Form errors={state.serverErrors} action={formAction} className={styles.Form}>
      <Field.Root name="username" className={styles.Field}>
        <Field.Label className={styles.Label}>Username</Field.Label>
        <Field.Control
          type="username"
          required
          defaultValue="admin"
          placeholder="e.g. alice132"
          className={styles.Input}
        />
        <Field.Error className={styles.Error} />
      </Field.Root>
      <Button type="submit" disabled={loading} focusableWhenDisabled className={styles.Button}>
        Submit
      </Button>
    </Form>
  );
}

// Mark this as a Server Function with `'use server'` in a supporting framework like Next.js
async function submitForm(_previousState: FormState, formData: FormData) {
  // Mimic a server response
  await new Promise((resolve) => {
    setTimeout(resolve, 1000);
  });

  try {
    const username = formData.get('username') as string | null;

    if (username === 'admin') {
      return { success: false, serverErrors: { username: "'admin' is reserved for system use" } };
    }

    // 50% chance the username is taken
    const success = Math.random() > 0.5;

    if (!success) {
      return {
        serverErrors: { username: `${username} is unavailable` },
      };
    }
  } catch {
    return { serverErrors: { username: 'A server error has occurred' } };
  }

  return {};
}
