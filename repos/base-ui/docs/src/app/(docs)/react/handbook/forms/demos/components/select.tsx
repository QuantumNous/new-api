import * as React from 'react';
import clsx from 'clsx';
import { Select } from '@base-ui/react/select';

export function Root(props: Select.Root.Props<any>) {
  return <Select.Root {...props} />;
}

export function Label({ className, ...props }: Select.Label.Props) {
  return (
    <Select.Label
      className={clsx(
        'cursor-default text-sm font-bold text-neutral-950 dark:text-white',
        className,
      )}
      {...props}
    />
  );
}

export function Trigger({ className, ...props }: Select.Trigger.Props) {
  return (
    <Select.Trigger
      className={clsx(
        'flex h-8 min-w-40 cursor-default items-center justify-between gap-3 border border-neutral-950 bg-white pl-2 pr-1 text-sm font-normal text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 active:not-data-disabled:bg-neutral-200 data-disabled:border-neutral-500 data-disabled:text-neutral-500 data-popup-open:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400 dark:data-popup-open:bg-neutral-800',
        className,
      )}
      {...props}
    />
  );
}

export function Value({ className, ...props }: Select.Value.Props) {
  return (
    <Select.Value
      className={clsx(
        'data-placeholder:text-neutral-500 dark:data-placeholder:text-neutral-400',
        className,
      )}
      {...props}
    />
  );
}

export function Icon(props: Select.Icon.Props) {
  return <Select.Icon {...props} />;
}

export function Portal(props: Select.Portal.Props) {
  return <Select.Portal {...props} />;
}

export function Positioner({ className, ...props }: Select.Positioner.Props) {
  return (
    <Select.Positioner
      className={clsx('outline-none select-none z-10', className)}
      sideOffset={4}
      {...props}
    />
  );
}

export function Popup({ className, ...props }: Select.Popup.Props) {
  return (
    <Select.Popup
      className={clsx(
        'group min-w-(--anchor-width) origin-(--transform-origin) border border-neutral-950 bg-white bg-clip-padding text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-[scale,opacity] duration-100 ease-out data-[side=none]:min-w-[calc(var(--anchor-width)+1.75rem)] data-[side=none]:translate-y-px data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-[side=none]:data-ending-style:transition-none data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-[side=none]:data-starting-style:scale-100 data-[side=none]:data-starting-style:opacity-100 data-[side=none]:data-starting-style:transition-none dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none',
        className,
      )}
      {...props}
    />
  );
}

export function ScrollUpArrow({ className, ...props }: Select.ScrollUpArrow.Props) {
  return (
    <Select.ScrollUpArrow
      className={clsx(
        "top-0 z-1 flex h-4 w-full cursor-default items-center justify-center bg-white text-center text-xs before:absolute data-[side=none]:before:-top-full before:left-0 before:h-full before:w-full before:content-[''] dark:bg-neutral-950",
        className,
      )}
      {...props}
    />
  );
}

export function ScrollDownArrow({ className, ...props }: Select.ScrollDownArrow.Props) {
  return (
    <Select.ScrollDownArrow
      className={clsx(
        "bottom-0 z-1 flex h-4 w-full cursor-default items-center justify-center bg-white text-center text-xs before:absolute before:left-0 before:h-full before:w-full before:content-[''] data-[side=none]:before:-bottom-full dark:bg-neutral-950",
        className,
      )}
      {...props}
    />
  );
}

export function List({ className, ...props }: Select.List.Props) {
  return (
    <Select.List
      className={clsx(
        'relative max-h-(--available-height) overflow-y-auto py-1 scroll-py-6',
        className,
      )}
      {...props}
    />
  );
}

export function Item({ className, ...props }: Select.Item.Props) {
  return (
    <Select.Item
      className={clsx(
        'grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 py-1.5 pr-4 pl-2.5 text-sm outline-none select-none group-data-[side=none]:pr-12 data-highlighted:bg-neutral-950 data-highlighted:text-white dark:data-highlighted:bg-white dark:data-highlighted:text-neutral-950',
        className,
      )}
      {...props}
    />
  );
}

export function ItemIndicator({ className, ...props }: Select.ItemIndicator.Props) {
  return <Select.ItemIndicator className={clsx('col-start-1', className)} {...props} />;
}

export function ItemText({ className, ...props }: Select.ItemText.Props) {
  return <Select.ItemText className={clsx('col-start-2', className)} {...props} />;
}
