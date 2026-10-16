import clsx from 'clsx';
import { Menu } from '@base-ui/react/menu';
import { ChevronDown, ChevronRight } from 'lucide-react';

export function Root(props: Menu.Root.Props) {
  return <Menu.Root {...props} />;
}

export function Trigger({ className, children, ...props }: Menu.Trigger.Props) {
  return (
    <Menu.Trigger
      className={clsx(
        'flex h-8 items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white pl-3 pr-2 text-sm font-medium text-gray-900 select-none hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-blue-600 active:bg-gray-100 data-popup-open:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50 dark:hover:bg-gray-800 dark:focus-visible:outline-blue-400 dark:active:bg-gray-800 dark:data-popup-open:bg-gray-800',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown className="size-4" />
    </Menu.Trigger>
  );
}

export function Portal(props: Menu.Portal.Props) {
  return <Menu.Portal {...props} />;
}

export function Positioner({ className, ...props }: Menu.Positioner.Props) {
  return <Menu.Positioner className={clsx('outline-hidden', className)} {...props} />;
}

export function Popup({ className, ...props }: Menu.Popup.Props) {
  return (
    <Menu.Popup
      className={clsx(
        'origin-(--transform-origin) rounded-md bg-white py-1 text-gray-900 shadow-xl shadow-black/10 outline-1 outline-gray-200 transition-[transform,scale,opacity] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 dark:bg-gray-900 dark:text-gray-50 dark:shadow-2xl dark:shadow-black/50 dark:outline-gray-800',
        className,
      )}
      {...props}
    />
  );
}

export function Arrow({ className, ...props }: Menu.Arrow.Props) {
  return (
    <Menu.Arrow
      className={clsx(
        'data-[side=bottom]:top-[-8px] data-[side=left]:right-[-13px] data-[side=left]:rotate-90 data-[side=right]:left-[-13px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-8px] data-[side=top]:rotate-180',
        className,
      )}
      {...props}
    >
      <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
        <path
          d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
          className="fill-white dark:fill-gray-900"
        />
        <path
          d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
          className="fill-gray-200 dark:fill-gray-800"
        />
        <path
          d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
          className="fill-none"
        />
      </svg>
    </Menu.Arrow>
  );
}

export function Item({ className, ...props }: Menu.Item.Props) {
  return (
    <Menu.Item
      className={clsx(
        'flex cursor-default py-2 pr-8 pl-4 text-sm leading-4 outline-hidden select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-gray-50 data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:rounded-sm data-highlighted:before:bg-gray-900 data-popup-open:relative data-popup-open:z-0 data-popup-open:before:absolute data-popup-open:before:inset-x-1 data-popup-open:before:inset-y-0 data-popup-open:before:z-[-1] data-popup-open:before:rounded-sm data-popup-open:before:bg-gray-100 data-highlighted:data-popup-open:before:bg-gray-900 dark:data-highlighted:text-gray-900 dark:data-highlighted:before:bg-gray-50 dark:data-popup-open:before:bg-gray-50 dark:data-highlighted:data-popup-open:before:bg-gray-50',
        className,
      )}
      {...props}
    />
  );
}

export function SubmenuRoot(props: Menu.SubmenuRoot.Props) {
  return <Menu.SubmenuRoot {...props} />;
}

export function SubmenuTrigger({ className, children, ...props }: Menu.SubmenuTrigger.Props) {
  return (
    <Menu.SubmenuTrigger
      className={clsx(
        'flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 outline-hidden select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-gray-50 data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:rounded-sm data-highlighted:before:bg-gray-900 data-popup-open:relative data-popup-open:z-0 data-popup-open:before:absolute data-popup-open:before:inset-x-1 data-popup-open:before:inset-y-0 data-popup-open:before:z-[-1] data-popup-open:before:rounded-sm data-popup-open:before:bg-gray-100 data-highlighted:data-popup-open:before:bg-gray-900 dark:data-highlighted:text-gray-900 dark:data-highlighted:before:bg-gray-50 dark:data-popup-open:before:bg-gray-800 dark:data-popup-open:before:text-gray-50 dark:data-highlighted:data-popup-open:before:bg-gray-50',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="size-4" />
    </Menu.SubmenuTrigger>
  );
}

export function Separator({ className, ...props }: Menu.Separator.Props) {
  return (
    <Menu.Separator
      className={clsx('mx-3 my-1.5 h-px bg-gray-200 dark:bg-gray-800', className)}
      {...props}
    />
  );
}
