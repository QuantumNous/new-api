import { Drawer } from '@base-ui/react/drawer';

export default function ExampleDrawer() {
  return (
    <Drawer.Root swipeDirection="right" modal={false} disablePointerDismissal>
      <Drawer.Trigger className="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 active:not-data-disabled:bg-neutral-200 data-disabled:border-neutral-500 data-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white">
        Open non-modal drawer
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Viewport className="[--viewport-padding:0px] supports-[-webkit-touch-callout:none]:[--viewport-padding:0.625rem] fixed inset-0 flex items-stretch justify-end p-(--viewport-padding) pointer-events-none">
          <Drawer.Popup className="[--bleed:3rem] supports-[-webkit-touch-callout:none]:[--bleed:0px] pointer-events-auto h-full w-[calc(20rem+3rem)] max-w-[calc(100vw-3rem+3rem)] -mr-[3rem] border-l border-neutral-950 bg-white p-6 pr-[calc(1.5rem+3rem)] text-neutral-950 outline-none shadow-[0.25rem_0.25rem_0] shadow-black/12 overflow-y-auto overscroll-contain touch-auto [transform:translateX(var(--drawer-swipe-movement-x))] transition-[transform,box-shadow] duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:select-none data-ending-style:shadow-[0.25rem_0.25rem_0] data-ending-style:shadow-black/0 data-ending-style:[transform:translateX(calc(100%-var(--bleed)+var(--viewport-padding)+2px))] data-starting-style:shadow-[0.25rem_0.25rem_0] data-starting-style:shadow-black/0 data-starting-style:[transform:translateX(calc(100%-var(--bleed)+var(--viewport-padding)+2px))] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] supports-[-webkit-touch-callout:none]:mr-0 supports-[-webkit-touch-callout:none]:w-[20rem] supports-[-webkit-touch-callout:none]:max-w-[calc(100vw-3rem)] supports-[-webkit-touch-callout:none]:border supports-[-webkit-touch-callout:none]:pr-6 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none">
            <Drawer.Content className="mx-auto w-full max-w-[32rem]">
              <Drawer.Title className="mb-1 text-base font-bold">Non-modal drawer</Drawer.Title>
              <Drawer.Description className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
                This drawer does not trap focus and ignores outside clicks. Use the close button or
                swipe to dismiss it.
              </Drawer.Description>
              <div className="flex justify-end gap-3">
                <Drawer.Close className="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 active:not-data-disabled:bg-neutral-200 data-disabled:border-neutral-500 data-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white">
                  Close
                </Drawer.Close>
              </div>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
