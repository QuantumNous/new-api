import * as React from 'react';
import clsx from 'clsx';
import { Combobox } from '@base-ui/react/combobox';
import { Check, ChevronDown, X } from 'lucide-react';

export function Root(props: Combobox.Root.Props<any, any>) {
  return <Combobox.Root {...props} />;
}

export const Input = React.forwardRef<HTMLInputElement, Combobox.Input.Props>(function (
  { className, ...props }: Combobox.Input.Props,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  return (
    <Combobox.Input
      ref={forwardedRef}
      className={clsx(
        'h-8 w-64 rounded-md border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 focus:outline-2 focus:-outline-offset-1 focus:outline-blue-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50 dark:focus:outline-blue-400',
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';

export function Clear({ className, ...props }: Combobox.Clear.Props) {
  return (
    <Combobox.Clear
      className={clsx(
        'combobox-clear flex h-8 w-6 items-center justify-center rounded-sm bg-transparent p-0',
        className,
      )}
      {...props}
    >
      <X className="size-4" />
    </Combobox.Clear>
  );
}

export function Trigger({ className, ...props }: Combobox.Trigger.Props) {
  return (
    <Combobox.Trigger
      className={clsx(
        'flex h-8 w-6 items-center justify-center rounded-sm bg-transparent p-0',
        className,
      )}
      {...props}
    >
      <ChevronDown className="size-4" />
    </Combobox.Trigger>
  );
}

export function Portal(props: Combobox.Portal.Props) {
  return <Combobox.Portal {...props} />;
}

export function Positioner({ className, ...props }: Combobox.Positioner.Props) {
  return (
    <Combobox.Positioner className={clsx('outline-hidden', className)} sideOffset={4} {...props} />
  );
}

export function Popup({ className, ...props }: Combobox.Popup.Props) {
  return (
    <Combobox.Popup
      className={clsx(
        'w-(--anchor-width) max-h-92 max-w-(--available-width) origin-(--transform-origin) rounded-md bg-white text-gray-900 shadow-xl shadow-black/10 outline-1 outline-gray-200 transition-[transform,scale,opacity] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 duration-100 dark:bg-gray-900 dark:text-gray-50 dark:shadow-2xl dark:shadow-black/50 dark:outline-gray-800',
        className,
      )}
      {...props}
    />
  );
}

export function Empty({ className, ...props }: Combobox.Empty.Props) {
  return (
    <Combobox.Empty
      className={clsx(
        'p-3 text-sm leading-5 text-gray-500 empty:m-0 empty:p-0 dark:text-gray-400',
        className,
      )}
      {...props}
    />
  );
}

export function List({ className, ...props }: Combobox.List.Props) {
  return (
    <Combobox.List
      className={clsx(
        'outline-0 overflow-y-auto scroll-py-2 py-1 overscroll-contain max-h-[min(23rem,var(--available-height))] data-empty:p-0',
        className,
      )}
      {...props}
    />
  );
}

export function Item({ className, ...props }: Combobox.Item.Props) {
  return (
    <Combobox.Item
      className={clsx(
        'grid cursor-default grid-cols-[0.75rem_1fr] items-center gap-2 py-2 pr-8 pl-4 text-sm leading-5 outline-hidden select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-gray-50 data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:rounded-sm data-highlighted:before:bg-gray-900 dark:data-highlighted:text-gray-900 dark:data-highlighted:before:bg-gray-50',
        className,
      )}
      {...props}
    />
  );
}

export function ItemIndicator({ className, ...props }: Combobox.ItemIndicator.Props) {
  return (
    <Combobox.ItemIndicator className={clsx('col-start-1', className)} {...props}>
      <Check className="size-4" />
    </Combobox.ItemIndicator>
  );
}
