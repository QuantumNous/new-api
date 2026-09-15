import * as React from 'react';
import { OTPField } from '@base-ui/react/otp-field';

const CODE_LENGTH = 6;

export default function OTPFieldPasswordDemo() {
  const id = React.useId();
  const descriptionId = `${id}-description`;

  return (
    <div className="flex w-full max-w-80 flex-col items-start gap-1">
      <label htmlFor={id} className="text-sm font-bold text-neutral-950 dark:text-white">
        Access code
      </label>
      <OTPField.Root
        id={id}
        length={CODE_LENGTH}
        mask
        aria-describedby={descriptionId}
        className="flex w-full gap-2"
      >
        {Array.from({ length: CODE_LENGTH }, (_, index) => (
          <OTPField.Input
            key={index}
            className="m-0 h-10 w-10 rounded-none border border-neutral-950 bg-white dark:bg-neutral-950 text-center font-inherit text-base font-normal text-neutral-950 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:text-white"
            aria-label={`Character ${index + 1} of ${CODE_LENGTH}`}
          />
        ))}
      </OTPField.Root>
      <p id={descriptionId} className="m-0 text-sm text-neutral-600 dark:text-neutral-400">
        Use <code className="font-mono">mask</code> to obscure the code on shared screens.
      </p>
    </div>
  );
}
