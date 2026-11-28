import * as React from 'react';
import { OTPField } from '@base-ui/react/otp-field';
import styles from './index.module.css';

const OTP_LENGTH = 6;

export default function OTPFieldGroupedDemo() {
  const id = React.useId();

  return (
    <div className={styles.Field}>
      <label htmlFor={id} className={styles.Label}>
        Verification code
      </label>
      <OTPField.Root id={id} length={OTP_LENGTH} className={styles.Root}>
        <div className={styles.Group}>
          {Array.from({ length: 3 }, (_, index) => (
            <OTPField.Input
              key={index}
              className={styles.Input}
              aria-label={`Character ${index + 1} of ${OTP_LENGTH}`}
            />
          ))}
        </div>
        <OTPField.Separator className={styles.Separator} />
        <div className={styles.Group}>
          {Array.from({ length: 3 }, (_, index) => (
            <OTPField.Input
              key={index + 3}
              className={styles.Input}
              aria-label={`Character ${index + 4} of ${OTP_LENGTH}`}
            />
          ))}
        </div>
      </OTPField.Root>
    </div>
  );
}
