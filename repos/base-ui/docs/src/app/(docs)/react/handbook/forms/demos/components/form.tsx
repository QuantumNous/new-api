import * as React from 'react';
import clsx from 'clsx';
import { Form as BaseForm } from '@base-ui/react/form';

export function Form({ className, ...props }: BaseForm.Props) {
  return (
    <BaseForm
      className={clsx('flex w-full max-w-3xs flex-col gap-5 sm:max-w-[20rem]', className)}
      {...props}
    />
  );
}
