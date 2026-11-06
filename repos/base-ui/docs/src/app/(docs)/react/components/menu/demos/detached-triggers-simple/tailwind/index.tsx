'use client';
import * as React from 'react';
import { Menu } from '@base-ui/react/menu';

const demoMenu = Menu.createHandle();

export default function MenuDetachedTriggersSimpleDemo() {
  return (
    <React.Fragment>
      <Menu.Trigger
        handle={demoMenu}
        aria-label="Project actions"
        className="flex size-8 items-center justify-center rounded-none border border-neutral-950 bg-white text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 active:not-data-disabled:bg-neutral-200 data-popup-open:bg-neutral-100 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:active:not-data-disabled:bg-neutral-700 data-disabled:border-neutral-500 data-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400 dark:data-popup-open:bg-neutral-800 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
      >
        <EllipsisHorizontalIcon />
      </Menu.Trigger>

      <Menu.Root handle={demoMenu}>
        <Menu.Portal>
          <Menu.Positioner sideOffset={8} className="outline-hidden">
            <Menu.Popup className={popupClass}>
              <Menu.Item className={itemClass}>Rename</Menu.Item>
              <Menu.Item className={itemClass}>Duplicate</Menu.Item>
              <Menu.Item className={itemClass}>Move to folder</Menu.Item>
              <Menu.Separator className="mx-1 my-1 h-px bg-neutral-950 dark:bg-white" />
              <Menu.Item className={itemClass}>Archive</Menu.Item>
              <Menu.Item className={`${itemClass} text-red-600`}>Delete</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </React.Fragment>
  );
}

const popupClass =
  'relative origin-[var(--transform-origin)] border border-neutral-950 bg-white py-1 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-hidden transition-[scale,opacity] duration-100 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none';
const itemClass =
  "flex cursor-default py-2 pr-8 pl-4 text-sm leading-4 outline-hidden select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] data-disabled:text-neutral-500 dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white dark:data-disabled:text-neutral-400";

function EllipsisHorizontalIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <circle cx="3" cy="8" r="1" />
      <circle cx="8" cy="8" r="1" />
      <circle cx="13" cy="8" r="1" />
    </svg>
  );
}
