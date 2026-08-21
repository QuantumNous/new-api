import { ScrollArea } from '@base-ui/react/scroll-area';

export default function ExampleScrollAreaBoth() {
  return (
    <ScrollArea.Root className="h-80 w-80 max-w-[calc(100vw-8rem)]">
      <ScrollArea.Viewport className="h-full border border-neutral-950 dark:border-white focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white">
        <ScrollArea.Content className="pt-3 pr-6 pb-6 pl-3">
          <ul className="m-0 grid list-none grid-cols-[repeat(10,6.25rem)] grid-rows-[repeat(10,6.25rem)] gap-3 p-0">
            {Array.from({ length: 100 }, (_, i) => (
              <li
                key={i}
                className="flex items-center justify-center bg-neutral-200 dark:bg-neutral-800 text-sm font-bold text-neutral-600 dark:text-neutral-400"
              >
                {i + 1}
              </li>
            ))}
          </ul>
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar className="relative m-px flex bg-black/12 dark:bg-white/12 opacity-0 transition-opacity pointer-events-none data-[orientation=vertical]:w-4 data-[orientation=horizontal]:h-4 data-hovering:pointer-events-auto data-hovering:opacity-100 data-scrolling:pointer-events-auto data-scrolling:opacity-100 data-scrolling:duration-0">
        <ScrollArea.Thumb className="w-full bg-neutral-950 dark:bg-white" />
      </ScrollArea.Scrollbar>
      <ScrollArea.Scrollbar
        className="relative m-px flex bg-black/12 dark:bg-white/12 opacity-0 transition-opacity pointer-events-none data-[orientation=vertical]:w-4 data-[orientation=horizontal]:h-4 data-hovering:pointer-events-auto data-hovering:opacity-100 data-scrolling:pointer-events-auto data-scrolling:opacity-100 data-scrolling:duration-0"
        orientation="horizontal"
      >
        <ScrollArea.Thumb className="w-full bg-neutral-950 dark:bg-white" />
      </ScrollArea.Scrollbar>
      <ScrollArea.Corner />
    </ScrollArea.Root>
  );
}
