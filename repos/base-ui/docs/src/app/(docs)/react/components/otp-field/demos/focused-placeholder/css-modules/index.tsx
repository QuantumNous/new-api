import * as React from 'react';
import { OTPField } from '@base-ui/react/otp-field';
import styles from './index.module.css';

const CODE_LENGTH = 6;

export default function OTPFieldFocusedPlaceholderDemo() {
  const id = React.useId();
  const descriptionId = `${id}-description`;

  return (
    <div className={styles.Field}>
      <label htmlFor={id} className={styles.Label}>
        Verification code
      </label>
      <OTPField.Root
        id={id}
        length={CODE_LENGTH}
        aria-describedby={descriptionId}
        className={styles.Root}
      >
        {Array.from({ length: CODE_LENGTH }, (_, index) => (
          <OTPField.Input
            key={index}
            className={styles.Input}
            placeholder="•"
            aria-label={`Character ${index + 1} of ${CODE_LENGTH}`}
          />
        ))}
      </OTPField.Root>
      <p id={descriptionId} className={styles.Description}>
        Placeholder hints can stay visible until the active slot is focused.
      </p>
    </div>
  );
}
