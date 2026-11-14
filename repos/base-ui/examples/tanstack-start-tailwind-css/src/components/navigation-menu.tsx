import clsx from 'clsx';
import { NavigationMenu } from '@base-ui/react/navigation-menu';
import { ChevronDown } from 'lucide-react';

export function Root({ className, ...props }: NavigationMenu.Root.Props) {
  return (
    <NavigationMenu.Root
      className={clsx(
        'box-border flex h-8 items-center rounded-md border border-gray-200 bg-white p-1 text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50 max-w-max',
        className,
      )}
      {...props}
    />
  );
}

export function Trigger({ className, children, ...props }: NavigationMenu.Trigger.Props) {
  return (
    <NavigationMenu.Trigger
      className={clsx(
        'box-border flex items-center justify-center gap-1',
        'h-6 rounded-sm pl-2 pr-1 text-gray-900 font-medium dark:text-gray-50',
        'text-sm leading-5 select-none no-underline',
        'hover:bg-gray-50 active:bg-gray-100 data-popup-open:bg-gray-50 dark:hover:bg-gray-800 dark:active:bg-gray-800 dark:data-popup-open:bg-gray-800',
        'focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400 focus-visible:relative',
        className,
      )}
      {...props}
    >
      {children}
      <Icon />
    </NavigationMenu.Trigger>
  );
}

export function Icon({ className, ...props }: NavigationMenu.Icon.Props) {
  return (
    <NavigationMenu.Icon
      className={clsx(
        'transition-transform duration-200 ease-in-out data-popup-open:rotate-180',
        className,
      )}
      {...props}
    >
      <ChevronDown className="size-4" />
    </NavigationMenu.Icon>
  );
}

export function Content({ className, ...props }: NavigationMenu.Content.Props) {
  return (
    <NavigationMenu.Content
      className={clsx(
        'h-full p-1.5 xs:min-w-[400px] xs:w-max',
        'transition-[opacity,transform,translate] duration-(--duration) ease-(--easing)',
        'data-starting-style:opacity-0 data-ending-style:opacity-0',
        'data-starting-style:data-[activation-direction=left]:translate-x-[-50%]',
        'data-starting-style:data-[activation-direction=right]:translate-x-[50%]',
        'data-ending-style:data-[activation-direction=left]:translate-x-[50%]',
        'data-ending-style:data-[activation-direction=right]:translate-x-[-50%]',
        className,
      )}
      {...props}
    />
  );
}

const cardLinkStyles = [
  'block rounded-lg p-3 no-underline text-inherit',
  'hover:bg-gray-100 focus-visible:relative focus-visible:outline-2 dark:hover:bg-gray-800',
  'focus-visible:-outline-offset-1 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400',
];

const textLinkStyles = [
  'box-border flex items-center justify-center gap-1.5',
  'h-6 rounded-sm px-2 text-gray-900 font-medium dark:text-gray-50',
  'text-sm leading-5 select-none no-underline',
  'hover:bg-gray-50 active:bg-gray-100 data-popup-open:bg-gray-50 dark:hover:bg-gray-800 dark:active:bg-gray-800 dark:data-popup-open:bg-gray-800',
  'focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400 focus-visible:relative',
];

export function Link({
  className,
  variant = 'text',
  ...props
}: NavigationMenu.Link.Props & { variant?: 'text' | 'card' }) {
  return (
    <NavigationMenu.Link
      className={clsx(variant === 'text' ? textLinkStyles : cardLinkStyles, className)}
      {...props}
    />
  );
}

export function Item(props: NavigationMenu.Item.Props) {
  return <NavigationMenu.Item {...props} />;
}

export function List({ className, ...props }: NavigationMenu.List.Props) {
  return <NavigationMenu.List className={clsx('relative flex gap-0.5', className)} {...props} />;
}

export function Portal(props: NavigationMenu.Portal.Props) {
  return <NavigationMenu.Portal {...props} />;
}

export function Positioner({ className, style, ...props }: NavigationMenu.Positioner.Props) {
  return (
    <NavigationMenu.Positioner
      className={clsx(
        'box-border h-(--positioner-height) w-(--positioner-width) max-w-(--available-width)',
        'transition-[top,left,right,bottom] duration-(--duration) ease-(--easing)',
        'before:absolute before:content-[""]',
        'data-instant:transition-none',
        'data-[side=bottom]:before:top-[-10px] data-[side=bottom]:before:right-0 data-[side=bottom]:before:left-0 data-[side=bottom]:before:h-2.5',
        'data-[side=left]:before:top-0 data-[side=left]:before:right-[-10px] data-[side=left]:before:bottom-0 data-[side=left]:before:w-2.5',
        'data-[side=right]:before:top-0 data-[side=right]:before:bottom-0 data-[side=right]:before:left-[-10px] data-[side=right]:before:w-2.5',
        'data-[side=top]:before:right-0 data-[side=top]:before:bottom-[-10px] data-[side=top]:before:left-0 data-[side=top]:before:h-2.5',
        className,
      )}
      style={{
        ['--duration' as string]: '0.35s',
        ['--easing' as string]: 'cubic-bezier(0.22, 1, 0.36, 1)',
        ...style,
      }}
      {...props}
    />
  );
}

export function Popup({ className, ...props }: NavigationMenu.Popup.Props) {
  return (
    <NavigationMenu.Popup
      className={clsx(
        'data-ending-style:easing-[ease] relative h-(--popup-height) origin-(--transform-origin) rounded-lg bg-white text-gray-900 shadow-xl shadow-black/10 outline-1 outline-gray-200 transition-[opacity,transform,width,height,scale,translate] duration-(--duration) ease-(--easing) data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 w-(--popup-width) xs:w-(--popup-width) dark:bg-gray-900 dark:text-gray-50 dark:shadow-2xl dark:shadow-black/50 dark:outline-gray-800',
        className,
      )}
      {...props}
    />
  );
}

export function Arrow({ className, ...props }: NavigationMenu.Arrow.Props) {
  return (
    <NavigationMenu.Arrow
      className={clsx(
        'flex transition-[left] duration-(--duration) ease-(--easing) data-[side=bottom]:top-[-8px] data-[side=left]:right-[-13px] data-[side=left]:rotate-90 data-[side=right]:left-[-13px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-8px] data-[side=top]:rotate-180',
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
    </NavigationMenu.Arrow>
  );
}

export function Viewport({ className, ...props }: NavigationMenu.Viewport.Props) {
  return (
    <NavigationMenu.Viewport
      className={clsx('relative h-full w-full overflow-hidden', className)}
      {...props}
    />
  );
}
