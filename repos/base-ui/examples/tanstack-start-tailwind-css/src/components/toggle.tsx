import * as React from 'react';
import clsx from 'clsx';
import { Toggle as BaseToggle } from '@base-ui/react/toggle';

export const Toggle = React.forwardRef<HTMLButtonElement, BaseToggle.Props>(function (
  { className, ...props }: BaseToggle.Props,
  forwardedRef: React.ForwardedRef<HTMLButtonElement>,
) {
  return (
    <BaseToggle
      ref={forwardedRef}
      className={clsx(
        'flex size-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-900 select-none hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-blue-600 active:bg-gray-100 data-pressed:[&_svg]:fill-current dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50 dark:hover:bg-gray-800 dark:focus-visible:outline-blue-400 dark:active:bg-gray-800',
        className,
      )}
      {...props}
    />
  );
});

Toggle.displayName = 'Toggle';
