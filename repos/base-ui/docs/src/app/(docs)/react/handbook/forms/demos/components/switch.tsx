import * as React from 'react';
import clsx from 'clsx';
import { Switch } from '@base-ui/react/switch';

export function Root({ className, ...props }: Switch.Root.Props) {
  return (
    <Switch.Root
      className={clsx(
        'flex h-5 w-9 shrink-0 border border-neutral-950 bg-white p-0.5 transition-colors duration-150 ease-[ease] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:focus-visible:outline-white data-checked:bg-neutral-950 dark:border-white dark:bg-neutral-950 dark:data-checked:bg-white',
        className,
      )}
      {...props}
    />
  );
}

export function Thumb({ className, ...props }: Switch.Thumb.Props) {
  return (
    <Switch.Thumb
      className={clsx(
        'size-3.5 bg-neutral-950 transition-[translate,background-color] duration-150 ease-[ease] data-checked:translate-x-4 data-checked:bg-white dark:bg-white dark:data-checked:bg-neutral-950',
        className,
      )}
      {...props}
    />
  );
}
