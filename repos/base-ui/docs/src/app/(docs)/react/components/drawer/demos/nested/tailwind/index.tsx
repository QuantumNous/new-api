'use client';
import { Drawer } from '@base-ui/react/drawer';

export default function ExampleDrawerNested() {
  return (
    <Drawer.Root>
      <Drawer.Trigger className="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 active:not-data-disabled:bg-neutral-200 data-disabled:border-neutral-500 data-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white">
        Open drawer stack
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop className="[--backdrop-opacity:0.2] [--bleed:3rem] dark:[--backdrop-opacity:0.7] fixed inset-0 min-h-dvh bg-black opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:duration-0 data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] supports-[-webkit-touch-callout:none]:absolute" />
        <Drawer.Viewport className="fixed inset-0 flex items-end justify-center">
          <Drawer.Popup className={popupClassName}>
            <div className={handleClassName} />
            <Drawer.Content className={contentClassName}>
              <Drawer.Title className="mb-1 text-base font-bold text-center">Account</Drawer.Title>
              <Drawer.Description className="mb-6 text-sm text-neutral-600 text-center dark:text-neutral-400">
                Nested drawers can be styled to stack, while each drawer remains independently focus
                managed.
              </Drawer.Description>

              <div className="flex items-center justify-end gap-4">
                <div className="mr-auto">
                  <Drawer.Root>
                    <Drawer.Trigger className="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 active:not-data-disabled:bg-neutral-200 data-disabled:border-neutral-500 data-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white">
                      Security settings
                    </Drawer.Trigger>
                    <Drawer.Portal>
                      <Drawer.Viewport className="fixed inset-0 flex items-end justify-center">
                        <Drawer.Popup className={popupClassName}>
                          <div className={handleClassName} />
                          <Drawer.Content className={contentClassName}>
                            <Drawer.Title className="mb-1 text-base font-bold text-center">
                              Security
                            </Drawer.Title>
                            <Drawer.Description className="mb-6 text-sm text-neutral-600 text-center dark:text-neutral-400">
                              Review sign-in activity and update your security preferences.
                            </Drawer.Description>

                            <ul className="mb-6 list-disc pl-5 text-neutral-700 dark:text-neutral-300">
                              <li>Passkeys enabled</li>
                              <li>2FA via authenticator app</li>
                              <li>3 signed-in devices</li>
                            </ul>

                            <div className="flex items-center justify-end gap-4">
                              <div className="mr-auto">
                                <Drawer.Root>
                                  <Drawer.Trigger className="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 active:not-data-disabled:bg-neutral-200 data-disabled:border-neutral-500 data-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white">
                                    Advanced options
                                  </Drawer.Trigger>
                                  <Drawer.Portal>
                                    <Drawer.Viewport className="fixed inset-0 flex items-end justify-center">
                                      <Drawer.Popup className={popupClassName}>
                                        <div className={handleClassName} />
                                        <Drawer.Content className={contentClassName}>
                                          <Drawer.Title className="mb-1 text-base font-bold text-center">
                                            Advanced
                                          </Drawer.Title>
                                          <Drawer.Description className="mb-6 text-sm text-neutral-600 text-center dark:text-neutral-400">
                                            This drawer is taller to demonstrate variable-height
                                            stacking.
                                          </Drawer.Description>

                                          <div className="grid gap-2 mb-4">
                                            <label
                                              className="text-sm font-bold text-neutral-700 dark:text-neutral-300"
                                              htmlFor="device-name-tw"
                                            >
                                              Device name
                                            </label>
                                            <input
                                              id="device-name-tw"
                                              className="h-8 w-full border border-neutral-950 bg-white px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
                                              defaultValue="Personal laptop"
                                            />
                                          </div>

                                          <div className="grid gap-2 mb-4">
                                            <label
                                              className="text-sm font-bold text-neutral-700 dark:text-neutral-300"
                                              htmlFor="notes-tw"
                                            >
                                              Notes
                                            </label>
                                            <textarea
                                              id="notes-tw"
                                              className="min-h-32 w-full resize-y border border-neutral-950 bg-white p-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
                                              defaultValue="Rotate recovery codes and revoke older sessions."
                                              rows={3}
                                            />
                                          </div>

                                          <div className="flex justify-end">
                                            <Drawer.Close className="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 active:not-data-disabled:bg-neutral-200 data-disabled:border-neutral-500 data-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white">
                                              Done
                                            </Drawer.Close>
                                          </div>
                                        </Drawer.Content>
                                      </Drawer.Popup>
                                    </Drawer.Viewport>
                                  </Drawer.Portal>
                                </Drawer.Root>
                              </div>

                              <Drawer.Close className="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 active:not-data-disabled:bg-neutral-200 data-disabled:border-neutral-500 data-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white">
                                Close
                              </Drawer.Close>
                            </div>
                          </Drawer.Content>
                        </Drawer.Popup>
                      </Drawer.Viewport>
                    </Drawer.Portal>
                  </Drawer.Root>
                </div>

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

const popupClassName =
  "[--bleed:3rem] [--peek:1rem] [--stack-progress:clamp(0,var(--drawer-swipe-progress),1)] [--stack-step:0.05] [--stack-peek-offset:max(0px,calc((var(--nested-drawers)-var(--stack-progress))*var(--peek)))] [--scale-base:calc(max(0,1-(var(--nested-drawers)*var(--stack-step))))] [--scale:clamp(0,calc(var(--scale-base)+(var(--stack-step)*var(--stack-progress))),1)] [--shrink:calc(1-var(--scale))] [--height:max(0px,calc(var(--drawer-frontmost-height,var(--drawer-height))-var(--bleed)))] group/popup relative -mx-px -mb-[3rem] w-[calc(100%+2px)] max-h-[calc(80vh+3rem)] [height:var(--drawer-height,auto)] border border-neutral-950 border-b-0 bg-white px-6 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px)+3rem)] text-neutral-950 outline-none shadow-[0.25rem_0.25rem_0] shadow-black/12 overflow-y-auto overscroll-contain touch-auto [transform-origin:50%_calc(100%-var(--bleed))] [transform:translateY(calc(var(--drawer-swipe-movement-y)-var(--stack-peek-offset)-(var(--shrink)*var(--height))))_scale(var(--scale))] after:pointer-events-none after:absolute after:inset-0 after:bg-transparent after:content-[''] after:transition-[background-color] after:duration-[450ms] after:ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:select-none data-swiping:duration-0 data-nested-drawer-swiping:duration-0 data-starting-style:[transform:translateY(calc(100%-var(--bleed)+2px))] data-ending-style:[transform:translateY(calc(100%-var(--bleed)+2px))] data-ending-style:opacity-[0.9999] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-ending-style:data-swiping:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-ending-style:data-nested-drawer-swiping:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-nested-drawer-open:h-[calc(var(--height)+var(--bleed))] data-nested-drawer-open:overflow-hidden data-nested-drawer-open:after:bg-black/5 dark:border-white dark:border-b-0 dark:bg-neutral-950 dark:text-white dark:shadow-none [transition:transform_450ms_cubic-bezier(0.32,0.72,0,1),height_450ms_cubic-bezier(0.32,0.72,0,1),opacity_450ms_cubic-bezier(0.32,0.72,0,1)]";

const contentClassName =
  'mx-auto w-full max-w-[32rem] transition-opacity duration-[300ms] ease-[cubic-bezier(0.45,1.005,0,1.005)] group-data-nested-drawer-open/popup:opacity-0 group-data-nested-drawer-swiping/popup:opacity-100';

const handleClassName =
  'mx-auto mb-4 h-1 w-12 bg-neutral-300 transition-opacity duration-[200ms] group-data-nested-drawer-open/popup:opacity-0 group-data-nested-drawer-swiping/popup:opacity-100 dark:bg-neutral-700';
