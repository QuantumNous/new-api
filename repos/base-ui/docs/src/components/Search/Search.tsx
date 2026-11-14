'use client';
import * as React from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { platform } from '@base-ui/utils/platform';
import './Search.css';

const sitemapPromise = () => import('../../app/sitemap');
const LazySearchBar = React.lazy(() =>
  import('./SearchBar').then((module) => ({ default: module.SearchBar })),
);

interface SearchRenderProps {
  isCmd: boolean;
}

interface SearchProps {
  children?: React.ReactNode | ((props: SearchRenderProps) => React.ReactNode);
  triggerProps?: Omit<Dialog.Trigger.Props, 'children' | 'handle'>;
  enableKeyboardShortcut?: boolean;
  containedScroll?: boolean;
}

export function Search({
  children,
  triggerProps,
  enableKeyboardShortcut = false,
  containedScroll = false,
}: SearchProps) {
  const [handle] = React.useState(() => Dialog.createHandle());
  const generatedTriggerId = React.useId();

  const isCmd = React.useSyncExternalStore(
    () => () => {},
    () => platform.os.mac,
    () => true,
  );
  const triggerId = triggerProps?.id ?? generatedTriggerId;

  React.useEffect(() => {
    if (!enableKeyboardShortcut) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        event.stopPropagation();

        if (!handle.isOpen) {
          handle.open(triggerId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [enableKeyboardShortcut, handle, triggerId]);

  return (
    <React.Fragment>
      <Dialog.Trigger {...triggerProps} id={triggerId} handle={handle}>
        {typeof children === 'function' ? children({ isCmd }) : children}
      </Dialog.Trigger>
      <React.Suspense fallback={null}>
        <LazySearchBar handle={handle} sitemap={sitemapPromise} containedScroll={containedScroll} />
      </React.Suspense>
    </React.Fragment>
  );
}
