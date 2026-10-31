import * as React from 'react';
import clsx from 'clsx';
import { Radio } from '@base-ui/react/radio';

export function Root({ className, ...props }: Radio.Root.Props) {
  return (
    <Radio.Root
      className={clsx(
        'flex size-4 shrink-0 items-center justify-center rounded-full border border-neutral-950 bg-white p-0 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:focus-visible:outline-white data-checked:bg-neutral-950 data-checked:text-white dark:border-white dark:bg-neutral-950 dark:text-neutral-950 dark:data-checked:bg-white dark:data-checked:text-neutral-950',
        className,
      )}
      {...props}
    />
  );
}

export function Indicator({ className, ...props }: Radio.Indicator.Props) {
  return (
    <Radio.Indicator
      className={clsx(
        'flex items-center justify-center data-unchecked:hidden before:size-2 before:rounded-full before:bg-current',
        className,
      )}
      {...props}
    />
  );
}
