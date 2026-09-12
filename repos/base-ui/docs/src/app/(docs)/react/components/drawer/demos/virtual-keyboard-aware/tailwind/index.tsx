'use client';
import { Drawer } from '@base-ui/react/drawer';

const fields = [
  ['Name', 'Ada Lovelace'],
  ['Phone', '+1 (555) 123-4567'],
  ['Street address', '12 Computing Way'],
  ['Apartment', 'Unit 4B'],
  ['City', 'San Francisco'],
  ['Postal code', '94107'],
  ['Delivery window', 'After 6 PM'],
  ['Backup contact', 'Grace Hopper'],
];

export default function ExampleDrawerVirtualKeyboardAware() {
  return (
    <Drawer.Root>
      <Drawer.Trigger className="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 active:not-data-disabled:bg-neutral-200 data-disabled:border-neutral-500 data-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white">
        Open keyboard-aware drawer
      </Drawer.Trigger>
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          <Drawer.Backdrop className="[--backdrop-opacity:0.2] [--bleed:3rem] dark:[--backdrop-opacity:0.7] fixed inset-0 min-h-dvh bg-black opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:duration-0 data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] supports-[-webkit-touch-callout:none]:absolute" />
          <Drawer.Viewport className="fixed inset-0 flex items-end justify-center touch-none [--bleed:3rem] after:pointer-events-none after:fixed after:inset-x-0 after:bottom-0 after:h-[var(--bleed)] after:bg-white after:content-[''] data-closed:after:opacity-0 has-[[data-swiping]]:after:opacity-0 dark:after:bg-neutral-950">
            <Drawer.Popup className="relative z-1 -mb-[var(--bleed)] flex h-[calc(100%-1rem+var(--bleed))] max-h-[calc(100%-1rem+var(--bleed))] w-full flex-col overflow-visible border-t border-neutral-950 bg-white text-neutral-950 outline-none touch-none shadow-[0.25rem_0.25rem_0] shadow-black/12 [--bleed:3rem] [--footer-reserved-height:calc(5.25rem+var(--bleed))] [transform:translateY(var(--drawer-swipe-movement-y))] transition-[transform,box-shadow] duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform data-swiping:select-none data-ending-style:[transform:translateY(calc(100%-var(--bleed)+2px))] data-starting-style:[transform:translateY(calc(100%-var(--bleed)+2px))] data-starting-style:shadow-[0.25rem_0.25rem_0] data-starting-style:shadow-black/0 data-ending-style:shadow-[0.25rem_0.25rem_0] data-ending-style:shadow-black/0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none">
              <div className="relative shrink-0 border-b border-neutral-300 px-6 py-4 touch-none select-none dark:border-neutral-700">
                <div className="absolute top-2 left-1/2 h-1 w-12 shrink-0 -translate-x-1/2 bg-neutral-300 dark:bg-neutral-700" />
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                  <Drawer.Close className="flex h-8 min-w-0 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none justify-self-start hover:not-data-disabled:bg-neutral-100 active:not-data-disabled:bg-neutral-200 data-disabled:border-neutral-500 data-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white">
                    Cancel
                  </Drawer.Close>
                  <Drawer.Title className="cursor-default text-center text-base font-bold">
                    Delivery details
                  </Drawer.Title>
                  <Drawer.Close className="flex h-8 min-w-0 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none justify-self-end hover:not-data-disabled:bg-neutral-100 active:not-data-disabled:bg-neutral-200 data-disabled:border-neutral-500 data-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white">
                    Save
                  </Drawer.Close>
                </div>
              </div>

              <Drawer.Content className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-auto px-6 pt-4 pb-6">
                <div className="mx-auto grid w-full max-w-90 gap-3">
                  {fields.map(([label, placeholder]) => (
                    <label className="flex w-full flex-col items-start gap-1" key={label}>
                      <span className="text-sm font-bold text-neutral-950 dark:text-white">
                        {label}
                      </span>
                      <input
                        className="h-8 w-full border border-neutral-950 bg-white px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 placeholder:text-neutral-500 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-400"
                        placeholder={placeholder}
                        type="text"
                      />
                    </label>
                  ))}

                  <label className="flex w-full flex-col items-start gap-1">
                    <span className="text-sm font-bold text-neutral-950 dark:text-white">
                      Instructions
                    </span>
                    <textarea
                      className="min-h-22 w-full resize-y border border-neutral-950 bg-white px-2 py-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 placeholder:text-neutral-500 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-400"
                      placeholder="Gate code, drop-off spot, or anything else the driver should know"
                    />
                  </label>
                </div>
              </Drawer.Content>

              <div className="relative min-h-[var(--footer-reserved-height)] shrink-0 transition-[min-height] duration-[260ms] ease-[cubic-bezier(0.32,0.72,0,1)] focus-within:min-h-[calc(var(--footer-reserved-height)+var(--drawer-keyboard-inset,0px))] motion-reduce:transition-none">
                <div className="absolute right-0 bottom-0 left-0 z-1 border-t border-neutral-950 bg-white px-6 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px)+var(--bleed))] transition-[bottom,padding-bottom] duration-[260ms] ease-[cubic-bezier(0.32,0.72,0,1)] will-change-[bottom,padding-bottom] focus-within:fixed focus-within:z-3 focus-within:bottom-0 focus-within:pb-[calc(0.625rem+env(safe-area-inset-bottom,0px)+var(--bleed)+var(--drawer-keyboard-inset,0px))] focus-within:[transform:translate3d(0,0,0)] motion-reduce:transition-none dark:border-white dark:bg-neutral-950">
                  <label className="mx-auto flex w-full max-w-90 flex-col gap-1">
                    <span className="text-sm font-bold text-neutral-950 dark:text-white">
                      Delivery note
                    </span>
                    <input
                      className="h-10 w-full border border-neutral-950 bg-white px-2.5 text-sm font-normal text-neutral-950 placeholder:text-neutral-500 any-pointer-coarse:text-base focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-400 dark:focus:outline-white"
                      placeholder="Add a note for the driver"
                      type="text"
                    />
                  </label>
                </div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  );
}
