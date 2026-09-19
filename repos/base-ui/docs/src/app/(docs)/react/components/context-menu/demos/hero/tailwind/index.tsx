import { ContextMenu } from '@base-ui/react/context-menu';

export default function ExampleMenu() {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger className="flex h-[12rem] w-[15rem] items-center justify-center rounded-none border border-neutral-950 bg-white text-neutral-950 select-none font-normal dark:border-white dark:bg-neutral-950 dark:text-white">
        Right click here
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner className="outline-hidden">
          <ContextMenu.Popup className="origin-[var(--transform-origin)] border border-neutral-950 bg-white py-1 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-hidden transition-[scale,opacity] duration-100 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none">
            <ContextMenu.Item className={itemClass}>Add to Library</ContextMenu.Item>
            <ContextMenu.Item className={itemClass}>Add to Playlist</ContextMenu.Item>
            <ContextMenu.Separator className="mx-1 my-1 h-px bg-neutral-950 dark:bg-white" />
            <ContextMenu.Item className={itemClass}>Play Next</ContextMenu.Item>
            <ContextMenu.Item className={itemClass}>Play Last</ContextMenu.Item>
            <ContextMenu.Separator className="mx-1 my-1 h-px bg-neutral-950 dark:bg-white" />
            <ContextMenu.Item className={itemClass}>Favorite</ContextMenu.Item>
            <ContextMenu.Item className={itemClass}>Share</ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

const itemClass =
  "flex cursor-default py-2 pr-8 pl-4 text-sm leading-4 outline-hidden select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] data-disabled:text-neutral-500 dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white dark:data-disabled:text-neutral-400";
