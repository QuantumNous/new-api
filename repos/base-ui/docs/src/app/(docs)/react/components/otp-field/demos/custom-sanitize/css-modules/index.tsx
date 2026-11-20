'use client';
import * as React from 'react';
import { OTPField } from '@base-ui/react/otp-field';
import { useInvalidFeedback } from '../useInvalidFeedback';
import styles from './index.module.css';

const CODE_LENGTH = 6;

function normalizeRecoveryCode(value: string) {
  return value.toUpperCase();
}

function getInvalidClassName(invalidPulse: number, evenClassName: string, oddClassName: string) {
  if (invalidPulse === 0) {
    return '';
  }

  return invalidPulse % 2 === 0 ? evenClassName : oddClassName;
}

export default function OTPFieldCustomNormalizeDemo() {
  const id = React.useId();
  const descriptionId = `${id}-description`;

  const {
    activeInvalidIndex,
    handleValueChange,
    handleValueInvalid,
    invalidPulse,
    setFocusedIndex,
    statusMessage,
  } = useInvalidFeedback();

  const invalidClassName = getInvalidClassName(
    invalidPulse,
    styles.InputInvalidB,
    styles.InputInvalidA,
  );

  return (
    <div className={styles.Field}>
      <label htmlFor={id} className={styles.Label}>
        Recovery code
      </label>
      <OTPField.Root
        id={id}
        length={CODE_LENGTH}
        validationType="alphanumeric"
        normalizeValue={normalizeRecoveryCode}
        onValueChange={handleValueChange}
        onValueInvalid={handleValueInvalid}
        aria-describedby={descriptionId}
        className={styles.Root}
      >
        {Array.from({ length: CODE_LENGTH }, (_, index) => (
          <OTPField.Input
            key={index}
            className={`${styles.Input} ${activeInvalidIndex === index ? invalidClassName : ''}`.trim()}
            aria-label={`Character ${index + 1} of ${CODE_LENGTH}`}
            onFocus={() => {
              setFocusedIndex(index);
            }}
          />
        ))}
      </OTPField.Root>
      <p id={descriptionId} className={styles.Description}>
        Letters and digits only. Letters are converted to uppercase.
      </p>
      <span aria-live="polite" className={styles.ScreenReaderOnly}>
        {statusMessage}
      </span>
    </div>
  );
}
