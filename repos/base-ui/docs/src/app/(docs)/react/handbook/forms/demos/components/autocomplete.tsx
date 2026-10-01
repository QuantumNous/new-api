import * as React from 'react';
import clsx from 'clsx';
import { Autocomplete } from '@base-ui/react/autocomplete';

export function Root(props: Autocomplete.Root.Props<any>) {
  return <Autocomplete.Root {...props} />;
}

export const Input = React.forwardRef<HTMLInputElement, Autocomplete.Input.Props>(function Input(
  { className, ...props }: Autocomplete.Input.Props,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  return (
    <Autocomplete.Input
      ref={forwardedRef}
      className={clsx(
        'h-8 w-[16rem] border border-neutral-950 bg-white px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 placeholder:text-neutral-500 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white md:w-[20rem] dark:border-white dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-400',
        className,
      )}
      {...props}
    />
  );
});

export function Portal(props: Autocomplete.Portal.Props) {
  return <Autocomplete.Portal {...props} />;
}

export function Positioner({ className, ...props }: Autocomplete.Positioner.Props) {
  return (
    <Autocomplete.Positioner
      className={clsx('outline-none data-empty:hidden', className)}
      sideOffset={4}
      {...props}
    />
  );
}

export function Popup({ className, ...props }: Autocomplete.Popup.Props) {
  return (
    <Autocomplete.Popup
      className={clsx(
        'w-(--anchor-width) max-w-(--available-width) border border-neutral-950 bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none',
        className,
      )}
      {...props}
    />
  );
}

export function List({ className, ...props }: Autocomplete.List.Props) {
  return (
    <Autocomplete.List
      className={clsx(
        'max-h-[min(22.5rem,var(--available-height))] overflow-y-auto overscroll-contain py-1 scroll-py-1 outline-0 data-empty:p-0',
        className,
      )}
      {...props}
    />
  );
}

export function Item({ className, ...props }: Autocomplete.Item.Props) {
  return (
    <Autocomplete.Item
      className={clsx(
        'flex cursor-default flex-col gap-0.25 py-2 pr-8 pl-2 text-sm leading-4 outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white',
        className,
      )}
      {...props}
    />
  );
}
