import * as React from 'react';
import clsx from 'clsx';
import { Input as BaseInput } from '@base-ui/react/input';

export const Input = React.forwardRef<HTMLInputElement, BaseInput.Props>(function (
  { className, ...props }: BaseInput.Props,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  return (
    <BaseInput
      ref={forwardedRef}
      className={clsx(
        'h-8 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-1 focus:outline-blue-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50 dark:placeholder:text-gray-400 dark:focus:outline-blue-400',
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';
