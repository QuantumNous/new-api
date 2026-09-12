import { Button as BaseButton } from '@base-ui/react/button';
import clsx from 'clsx';

export function Button({ className, ...props }: React.ComponentPropsWithoutRef<'button'>) {
  return (
    <BaseButton
      type="button"
      className={clsx(
        'flex h-8 items-center justify-center rounded-md border border-gray-200 bg-white px-3 font-inherit text-sm font-medium leading-5 text-gray-900 outline-0 select-none hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-blue-600 active:bg-gray-100 data-disabled:text-gray-400 data-disabled:hover:bg-white dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50 dark:hover:bg-gray-800 dark:focus-visible:outline-blue-400 dark:active:bg-gray-800 dark:data-disabled:bg-gray-900 dark:data-disabled:text-gray-500',
        className,
      )}
      {...props}
    />
  );
}
