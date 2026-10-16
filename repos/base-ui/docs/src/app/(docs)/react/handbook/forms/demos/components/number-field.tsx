import * as React from 'react';
import clsx from 'clsx';
import { NumberField } from '@base-ui/react/number-field';

export function Root({ className, ...props }: NumberField.Root.Props) {
  return (
    <NumberField.Root className={clsx('flex flex-col items-start gap-1', className)} {...props} />
  );
}

export function Group({ className, ...props }: NumberField.Group.Props) {
  return <NumberField.Group className={clsx('flex h-8', className)} {...props} />;
}

export function Decrement({ className, ...props }: NumberField.Decrement.Props) {
  return (
    <NumberField.Decrement
      className={clsx(
        'flex h-full w-8 items-center justify-center rounded-none border border-neutral-950 bg-white bg-clip-padding text-neutral-950 outline-0 select-none hover:not-data-disabled:bg-neutral-100 active:not-data-disabled:bg-neutral-200 data-disabled:border-neutral-500 data-disabled:text-neutral-500 focus-visible:z-1 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400',
        className,
      )}
      {...props}
    />
  );
}

export const Input = React.forwardRef<HTMLInputElement, NumberField.Input.Props>(function Input(
  { className, ...props }: NumberField.Input.Props,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  return (
    <NumberField.Input
      ref={forwardedRef}
      className={clsx(
        'h-full w-16 rounded-none border-y border-neutral-950 bg-white px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 tabular-nums focus:z-1 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:bg-neutral-950 dark:text-white',
        className,
      )}
      {...props}
    />
  );
});

export function Increment({ className, ...props }: NumberField.Increment.Props) {
  return (
    <NumberField.Increment
      className={clsx(
        'flex h-full w-8 items-center justify-center rounded-none border border-neutral-950 bg-white bg-clip-padding text-neutral-950 outline-0 select-none hover:not-data-disabled:bg-neutral-100 active:not-data-disabled:bg-neutral-200 data-disabled:border-neutral-500 data-disabled:text-neutral-500 focus-visible:z-1 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400',
        className,
      )}
      {...props}
    />
  );
}
