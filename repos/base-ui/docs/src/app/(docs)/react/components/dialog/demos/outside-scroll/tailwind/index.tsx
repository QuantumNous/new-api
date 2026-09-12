'use client';
import * as React from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { ScrollArea } from '@base-ui/react/scroll-area';

export default function OutsideScrollDialog() {
  const popupRef = React.useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root>
      <Dialog.Trigger className="flex h-8 items-center justify-center gap-2 border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 dark:text-white select-none hover:not-data-disabled:bg-neutral-100 dark:hover:not-data-disabled:bg-neutral-800 active:not-data-disabled:bg-neutral-200 dark:active:not-data-disabled:bg-neutral-700 data-disabled:border-neutral-500 data-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white">
        Open dialog
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/20 dark:bg-black/50 transition-opacity duration-[600ms] ease-[var(--ease-out-fast)] data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-[350ms] data-ending-style:ease-[cubic-bezier(0.375,0.015,0.545,0.455)] supports-[-webkit-touch-callout:none]:absolute" />
        <Dialog.Viewport className="group/dialog fixed inset-0">
          <ScrollArea.Root
            style={{ position: undefined }}
            className="h-full overscroll-contain group-data-ending-style/dialog:pointer-events-none"
          >
            <ScrollArea.Viewport className="h-full overscroll-contain group-data-ending-style/dialog:pointer-events-none">
              <ScrollArea.Content className="flex min-h-full items-center justify-center">
                <Dialog.Popup
                  ref={popupRef}
                  initialFocus={popupRef}
                  className="outline-0 relative mx-auto my-16 flex w-[min(40rem,calc(100vw-2rem))] flex-col gap-4 bg-white dark:bg-neutral-950 p-4 text-neutral-950 dark:text-white border border-neutral-950 dark:border-white shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:shadow-none transition-[translate] duration-[700ms] ease-[cubic-bezier(0.45,1.005,0,1.005)] data-starting-style:translate-y-[100dvh] data-ending-style:translate-y-[max(100dvh,100%)] data-ending-style:duration-[350ms] data-ending-style:ease-[cubic-bezier(0.375,0.015,0.545,0.455)] motion-reduce:transition-none"
                >
                  <div className="relative flex flex-col gap-1 pr-8">
                    <Dialog.Title className="text-base font-bold">Dialog</Dialog.Title>
                    <Dialog.Description className="text-sm text-neutral-600 dark:text-neutral-400">
                      This layout keeps an outer container scrollable while the dialog can extend
                      past the bottom edge.
                    </Dialog.Description>
                    <Dialog.Close
                      aria-label="Close"
                      className="absolute -top-1 -right-1 inline-flex items-center justify-center w-8 h-8 border-none bg-transparent p-0 text-neutral-950 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 active:bg-neutral-200 dark:active:bg-neutral-700 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
                    >
                      <XIcon />
                    </Dialog.Close>
                  </div>

                  <div className="flex flex-col gap-4">
                    {CONTENT_SECTIONS.map((item) => (
                      <section className="flex flex-col gap-1" key={item.title}>
                        <h3 className="text-sm font-bold">{item.title}</h3>
                        <p className="text-sm text-neutral-700 dark:text-neutral-300">
                          {item.body}
                        </p>
                      </section>
                    ))}
                  </div>

                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Related docs:{' '}
                    {RELATED_LINKS.map((item, index) => (
                      <React.Fragment key={item.href}>
                        {index > 0 ? ', ' : null}
                        <a
                          className="text-neutral-950 dark:text-white underline underline-offset-[0.16em] decoration-[1px] hover:no-underline focus-visible:outline-2 focus-visible:outline-neutral-950 dark:focus-visible:outline-white focus-visible:outline-offset-2"
                          href={item.href}
                        >
                          {item.label}
                        </a>
                      </React.Fragment>
                    ))}
                    .
                  </p>
                </Dialog.Popup>
              </ScrollArea.Content>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar className="pointer-events-none flex w-4 justify-center bg-black/12 dark:bg-white/12 opacity-0 transition-opacity duration-[250ms] data-scrolling:pointer-events-auto data-scrolling:opacity-100 data-scrolling:duration-[75ms] data-scrolling:delay-[0ms] hover:pointer-events-auto hover:opacity-100 hover:duration-[75ms] hover:delay-[0ms] group-data-ending-style/dialog:opacity-0 group-data-ending-style/dialog:duration-[250ms]">
              <ScrollArea.Thumb className="w-full bg-neutral-950 dark:bg-white" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function XIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="m2.5 2.5 11 11m-11 0 11-11" />
    </svg>
  );
}

const CONTENT_SECTIONS = [
  {
    title: 'What a dialog is for',
    body: 'Use a dialog when you need the user to complete a focused task or read something important without navigating away. It opens on top of the page and returns focus back where it started when closed.',
  },
  {
    title: 'Anatomy at a glance',
    body: 'Root, Trigger, Portal, Backdrop, Viewport, Popup, Title, Description, Close. Keep the title short and the first paragraph specific so screen readers announce something meaningful.',
  },
  {
    title: 'Opening and closing',
    body: 'Control it using external state via the `open` and `onOpenChange` props, or let it manage state for you internally.',
  },
  {
    title: 'Keyboard and focus behavior',
    body: 'Focus moves inside the dialog when it opens. Tab and Shift+Tab loop within, and Esc requests close.',
  },
  {
    title: 'Accessible labeling',
    body: 'Set an explicit title and description using the `Dialog.Title` and `Dialog.Description` components.',
  },
  {
    title: 'Backdrop and page scrolling',
    body: 'The backdrop visually separates layers while background content is inert. Don’t rely on dimness alone—keep copy clear and buttons obvious so actions are easy to choose.',
  },
  {
    title: 'Portals and stacking',
    body: 'Dialogs render in a portal so they sit above the `isolation: isolate` app content and avoid local z-index wars.',
  },
  {
    title: 'Viewport overflow',
    body: 'Let long content overflow the bottom edge and reveal as you scroll the page container. Keep generous padding at the top and bottom so the dialog doesn’t feel jammed against the edges.',
  },
  {
    title: 'Nested dialogs and confirmations',
    body: 'If closing a dialog needs confirmation, open a child alert dialog rather than mutating the current one. The parent stays visible behind it; only the topmost layer should feel interactive.',
  },
  {
    title: 'Transitions that respect motion settings',
    body: 'Use small, fast transitions (opacity plus a few pixels of Y translation or scale). Subtle motion helps people notice what changed without slowing them down.',
  },
  {
    title: 'Controlled vs. uncontrolled',
    body: 'Controlled state is best when other parts of the page need to react to open/close. Uncontrolled is fine for local cases where only the dialog matters.',
  },
  {
    title: 'Close affordances',
    body: 'Always offer a visible close button in the corner. Don’t rely only on Esc or the backdrop for pointer outside presses. Touch screen readers and accessibility users benefit from a clear, targetable control to click to close the dialog.',
  },
  {
    title: 'Forms inside dialogs',
    body: 'Keep forms short; longer flows usually deserve a full page. Validate inline, keep button text specific (“Create project”), and disable destructive actions until the input is valid.',
  },
  {
    title: 'Content guidelines',
    body: 'Lead with the outcome (“Rename project?”) and follow with one or two short, concrete sentences. Avoid long prose; link out for details instead.',
  },
  {
    title: 'SSR and hydration notes',
    body: 'Because dialogs render in a portal, make sure your portal container exists on the client.',
  },
  {
    title: 'Mobile ergonomics',
    body: 'Use larger touch targets and keep the close button reachable with the thumb. Avoid full-screen modals unless the task truly needs a whole screen.',
  },
  {
    title: 'Theming and density',
    body: 'Match spacing and corner radius to your system. Use a slightly denser layout than pages so the dialog feels purpose-built, not like a mini web page.',
  },
  {
    title: 'Internationalization',
    body: 'Plan for longer text. Buttons can grow to two lines; titles should wrap gracefully. Keep destructive terms consistent across locales.',
  },
  {
    title: 'Performance',
    body: 'Children are mounted lazily when the dialog opens. If the dialog can reopen often, consider the `keepMounted` prop sparingly to perform the work only once on mount to avoid re-initializing complex React trees on each open.',
  },
  {
    title: 'When a popover is better',
    body: 'If the content is a small hint or a few quick actions anchored to a control, use a popover or menu instead of a dialog. Dialogs interrupt on purpose—use that sparingly.',
  },
  {
    title: 'Follow-up and cleanup',
    body: 'After a successful action, close the dialog and show confirmation in context (toast, inline message, or updated UI) so people can see the result of what they just did.',
  },
];

const RELATED_LINKS = [
  { href: '/react/components/scroll-area', label: 'Scroll Area' },
  { href: '/react/components/drawer', label: 'Drawer' },
  { href: '/react/components/popover', label: 'Popover' },
] as const;
