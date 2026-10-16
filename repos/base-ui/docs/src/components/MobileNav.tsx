'use client';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import clsx from 'clsx';
import NextLink from 'next/link';
import { Dialog } from '@base-ui/react/dialog';
import { useScrollLock } from '@base-ui/utils/useScrollLock';
import { HEADER_HEIGHT_MOBILE } from './Header';
import './MobileNav.css';

const MobileNavStateCallback = React.createContext<(open: boolean) => void>(() => undefined);

export function Root(props: Dialog.Root.Props) {
  const state = React.useState(false);
  const [open, setOpen] = state;

  return (
    <MobileNavStateCallback.Provider value={setOpen}>
      <Dialog.Root open={open} onOpenChange={setOpen} {...props} />
    </MobileNavStateCallback.Provider>
  );
}

export const Trigger = Dialog.Trigger;

export function Backdrop(props: Dialog.Backdrop.Props) {
  return <Dialog.Backdrop {...props} className={clsx('MobileNavBackdrop', props.className)} />;
}

export const Portal = Dialog.Portal;

export function Popup(props: Dialog.Popup.Props) {
  return (
    <Dialog.Popup {...props} className={clsx('MobileNavPopup', props.className)}>
      <PopupImpl>{props.children}</PopupImpl>
    </Dialog.Popup>
  );
}

function PopupImpl(props: React.PropsWithChildren) {
  const [forceScrollLock, setForceScrollLock] = React.useState(false);
  const setOpen = React.useContext(MobileNavStateCallback);
  const rem = React.useRef(16);
  useScrollLock(forceScrollLock);

  React.useEffect(() => {
    rem.current = parseFloat(getComputedStyle(document.documentElement).fontSize);
  }, []);

  return (
    <React.Fragment>
      <div className="MobileNavBottomOverscroll" />
      <div
        className="MobileNavViewport"
        onScroll={(event) => {
          const viewport = event.currentTarget;
          if (viewport.scrollTop > (HEADER_HEIGHT_MOBILE * rem.current) / 16) {
            viewport.setAttribute('data-clipped', '');
          } else {
            viewport.removeAttribute('data-clipped');
          }
        }}
        onTouchStart={(event) => {
          const viewport = event.currentTarget;

          // Consider flicks from scroll top only (iOS does the same with its sheets)
          if (viewport.scrollTop <= 0) {
            viewport.addEventListener(
              'touchend',
              function handleTouchEnd() {
                // If touch ended and we are overscrolling past a threshold...
                if (viewport.scrollTop < -32) {
                  const y = viewport.scrollTop;
                  // Scroll lock is forced during the flick down gesture to maintain
                  // a continuous blend between the native scroll inertia and our own animation
                  setForceScrollLock(true);

                  viewport.addEventListener(
                    'scroll',
                    function handleNextScroll() {
                      // ...look at whether the system's inertia scrolling is continuing the motion
                      // in the same direction. If so, the flick is strong enough to close the dialog.
                      if (viewport.scrollTop < y) {
                        // It's gonna eventually bounce back to scrollTop 0. We need to counteract this
                        // a bit so that the close transition doesn't appear slower than it should.
                        viewport.style.translate = `0px -${y}px`;
                        viewport.style.transform = `400ms`;
                        setOpen(false);

                        // Sometimes the first scroll event comes with the same scroll position
                        // If so, give it another chance, call ourselves recursively
                      } else if (viewport.scrollTop === y) {
                        viewport.addEventListener('scroll', handleNextScroll, { once: true });
                      } else {
                        setForceScrollLock(false);
                      }
                    },
                    { once: true },
                  );
                }
              },
              { once: true },
            );
          }
        }}
      >
        <div className="MobileNavViewportInner">
          {/* We need the area behind the panel to close on tap but also to scroll the viewport. */}
          <Dialog.Close
            className="MobileNavBackdropTapArea"
            tabIndex={-1}
            nativeButton={false}
            render={<div />}
          />

          <nav className="MobileNavPanel">
            {/* Reverse order to place the close button at the end of the DOM, but at sticky top visually */}
            <div className="MobileNavBody">
              <div>{props.children}</div>
              <div className="MobileNavCloseContainer">
                <Dialog.Close aria-label="Close the navigation" className="MobileNavClose">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M0.75 0.75L6 6M11.25 11.25L6 6M6 6L0.75 11.25M6 6L11.25 0.75"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Dialog.Close>
              </div>
            </div>
          </nav>
        </div>
      </div>
    </React.Fragment>
  );
}

export function Section(props: React.ComponentProps<'div'>) {
  return <div {...props} className={clsx('MobileNavSection', props.className)} />;
}

export function Heading(props: React.ComponentProps<'div'>) {
  return (
    <div {...props} className={clsx('MobileNavHeading', props.className)}>
      <div className="MobileNavHeadingInner">{props.children}</div>
    </div>
  );
}

export function List(props: React.ComponentProps<'ul'>) {
  return <ul {...props} className={clsx('MobileNavList', props.className)} />;
}

export function Badge(props: React.ComponentProps<'span'>) {
  return <span {...props} className={clsx('MobileNavBadge', props.className)} />;
}

interface ItemProps extends React.ComponentPropsWithoutRef<'li'> {
  active?: boolean;
  href: string;
  rel?: string;
  external?: boolean;
}

export function Item({ href, external, ...props }: ItemProps) {
  const setOpen = React.useContext(MobileNavStateCallback);

  const LinkComponent = external ? 'a' : NextLink;

  return (
    <li {...props} className={clsx('MobileNavItem', props.className)}>
      <LinkComponent
        aria-current={props.active ? 'page' : undefined}
        className="MobileNavLink"
        href={href}
        rel={props.rel}
        // We handle scroll manually
        scroll={external ? undefined : false}
        onClick={() => {
          if (href === window.location.pathname) {
            // If the URL is the same, close, wait a little, and scroll to top smoothly
            setOpen(false);
            setTimeout(() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 500);
          } else {
            // Otherwise, wait for the URL change before closing and scroll up instantly
            onUrlChange(() => {
              ReactDOM.flushSync(() => setOpen(false));
              window.scrollTo({ top: 0, behavior: 'instant' });
            });
          }
        }}
      >
        {props.children}
      </LinkComponent>
    </li>
  );
}

function onUrlChange(callback: () => void) {
  const initialUrl = window.location.href;

  function rafRecursively() {
    requestAnimationFrame(() => {
      if (initialUrl === window.location.href) {
        rafRecursively();
      } else {
        callback();
      }
    });
  }

  rafRecursively();
}
