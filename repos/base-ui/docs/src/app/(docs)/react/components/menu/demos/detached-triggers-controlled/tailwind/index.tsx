'use client';
import * as React from 'react';
import { Menu } from '@base-ui/react/menu';

interface MenuItemDefinition {
  label: string;
  onClick?: () => void;
}

/* eslint-disable no-console */
const MENUS = {
  library: [
    { label: 'Add to library', onClick: () => console.log('Adding to library') },
    { label: 'Add to favorites', onClick: () => console.log('Adding to favorites') },
  ] as MenuItemDefinition[],
  playback: [
    { label: 'Play', onClick: () => console.log('Playing') },
    { label: 'Add to queue', onClick: () => console.log('Adding to queue') },
  ] as MenuItemDefinition[],
  share: [
    { label: 'Share', onClick: () => console.log('Sharing') },
    { label: 'Copy link', onClick: () => console.log('Copying') },
  ] as MenuItemDefinition[],
};
/* eslint-enable no-console */

type MenuKey = keyof typeof MENUS;

const demoMenu = Menu.createHandle<MenuKey>();

export default function MenuDetachedTriggersControlledDemo() {
  const [open, setOpen] = React.useState(false);
  const [activeTrigger, setActiveTrigger] = React.useState<string | null>(null);

  const handleOpenChange = (isOpen: boolean, eventDetails: Menu.Root.ChangeEventDetails) => {
    setOpen(isOpen);
    if (isOpen) {
      setActiveTrigger(eventDetails.trigger?.id ?? null);
    }
  };

  return (
    <React.Fragment>
      <div className="flex flex-wrap items-center gap-2">
        <Menu.Trigger
          handle={demoMenu}
          payload={'library' as const}
          id="menu-trigger-1"
          className={triggerClass}
        >
          Library
        </Menu.Trigger>
        <Menu.Trigger
          handle={demoMenu}
          payload={'playback' as const}
          id="menu-trigger-2"
          className={triggerClass}
        >
          Playback
        </Menu.Trigger>
        <Menu.Trigger
          handle={demoMenu}
          payload={'share' as const}
          id="menu-trigger-3"
          className={triggerClass}
        >
          Share
        </Menu.Trigger>

        <button
          type="button"
          className={triggerClass}
          onClick={() => {
            setActiveTrigger('menu-trigger-2');
            setOpen(true);
          }}
        >
          Open playback (controlled)
        </button>
      </div>

      <Menu.Root
        handle={demoMenu}
        open={open}
        triggerId={activeTrigger}
        onOpenChange={handleOpenChange}
      >
        {({ payload }) => (
          <Menu.Portal>
            <Menu.Positioner sideOffset={8} className="outline-hidden">
              <Menu.Popup className={popupClass}>
                {payload &&
                  MENUS[payload].map((item, index) => (
                    <Menu.Item key={index} className={itemClass} onClick={item.onClick}>
                      {item.label}
                    </Menu.Item>
                  ))}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        )}
      </Menu.Root>
    </React.Fragment>
  );
}

const itemClass =
  "flex cursor-default py-2 pr-8 pl-4 text-sm leading-4 outline-hidden select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] data-disabled:text-neutral-500 dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white dark:data-disabled:text-neutral-400";
const triggerClass =
  'flex h-8 items-center justify-center gap-2 rounded-none border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white active:bg-neutral-200 data-popup-open:bg-neutral-100 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:bg-neutral-800 dark:active:bg-neutral-700 dark:data-popup-open:bg-neutral-800';
const popupClass =
  'relative origin-[var(--transform-origin)] border border-neutral-950 bg-white py-1 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-hidden transition-[scale,opacity] duration-100 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none';
