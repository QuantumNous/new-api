'use client';
import * as React from 'react';
import { Drawer } from '@base-ui/react/drawer';

const TOP_MARGIN_REM = 1;
const VISIBLE_SNAP_POINTS_REM = [30];

function toViewportSnapPoint(heightRem: number) {
  return `${heightRem + TOP_MARGIN_REM}rem`;
}

const snapPoints = [...VISIBLE_SNAP_POINTS_REM.map(toViewportSnapPoint), 1];

export default function ExampleDrawerSnapPoints() {
  return (
    <Drawer.Root snapPoints={snapPoints}>
      <Drawer.Trigger className="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 active:not-data-disabled:bg-neutral-200 data-disabled:border-neutral-500 data-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white">
        Open snap drawer
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop className="[--backdrop-opacity:0.2] [--bleed:3rem] dark:[--backdrop-opacity:0.7] fixed inset-0 min-h-dvh bg-black opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:duration-0 data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] supports-[-webkit-touch-callout:none]:absolute" />
        <Drawer.Viewport className="fixed inset-0 flex items-end justify-center touch-none [--bleed:3rem] after:pointer-events-none after:fixed after:inset-x-0 after:bottom-0 after:h-[var(--bleed)] after:bg-white after:content-[''] data-closed:after:opacity-0 dark:after:bg-neutral-950">
          <Drawer.Popup
            className="relative z-1 flex w-full max-h-[calc(100dvh-var(--top-margin))] min-h-0 flex-col overflow-visible border-t border-neutral-950 bg-white text-neutral-950 outline-none touch-none shadow-[0.25rem_0.25rem_0] shadow-black/12 [padding-bottom:max(0px,calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))] [transform:translateY(calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))] transition-[transform,box-shadow] duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[var(--bleed)] after:bg-[inherit] after:content-[''] data-ending-style:[transform:translateY(calc(100%+2px))] data-starting-style:[transform:translateY(calc(100%+2px))] data-starting-style:[padding-bottom:0] data-ending-style:[padding-bottom:0] data-starting-style:shadow-[0.25rem_0.25rem_0] data-starting-style:shadow-black/0 data-ending-style:shadow-[0.25rem_0.25rem_0] data-ending-style:shadow-black/0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
            style={{ '--top-margin': `${TOP_MARGIN_REM}rem` } as React.CSSProperties}
          >
            <div className="shrink-0 border-b border-neutral-300 px-6 pt-3.5 pb-4 touch-none select-none dark:border-neutral-700">
              <div className="mx-auto mb-2.5 h-1 w-12 shrink-0 bg-neutral-300 dark:bg-neutral-700" />
              <Drawer.Title className="cursor-default text-center text-base font-bold">
                Snap points
              </Drawer.Title>
            </div>
            <Drawer.Content className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-auto px-6 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
              <div className="mx-auto w-full max-w-90">
                <Drawer.Description className="mb-4 text-sm text-neutral-600 text-center dark:text-neutral-400">
                  Drag the sheet to snap between a compact peek and a near full-height view.
                </Drawer.Description>
                <div className="grid gap-3 mb-6" aria-hidden>
                  {Array.from({ length: 20 }, (_, index) => (
                    <div key={index} className="h-12 bg-neutral-200 dark:bg-neutral-700" />
                  ))}
                </div>
                <div className="flex items-center justify-end gap-3">
                  <Drawer.Close className="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 active:not-data-disabled:bg-neutral-200 data-disabled:border-neutral-500 data-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white">
                    Close
                  </Drawer.Close>
                </div>
              </div>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
