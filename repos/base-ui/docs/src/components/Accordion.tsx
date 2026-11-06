'use client';
import * as React from 'react';
import clsx from 'clsx';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { useGoogleAnalytics } from 'docs/src/blocks/GoogleAnalyticsProvider';
import { observeScrollableInner } from '../utils/observeScrollableInner';

export function Root(props: React.ComponentProps<'section'>) {
  return <section {...props} className={clsx('AccordionRoot', props.className)} />;
}

export function Trigger(props: React.ComponentProps<'summary'>) {
  return (
    <summary
      {...props}
      className={clsx('AccordionTrigger', props.className)}
      onClick={(event) => {
        const selection = window.getSelection();
        if (!selection?.isCollapsed) {
          event.preventDefault();
        }
        props.onClick?.(event);
      }}
      onMouseDown={(event) => {
        if (!event.defaultPrevented && event.detail > 1) {
          event.preventDefault();
        }
      }}
    />
  );
}

export function Item({
  gaCategory,
  gaLabel,
  gaParams,
  ...props
}: React.ComponentProps<'details'> & {
  gaCategory?: string;
  gaLabel?: string;
  gaParams?: Record<string, string | number | boolean>;
}) {
  const [open, setOpen] = React.useState<boolean>(false);
  const detailsRef = React.useRef<HTMLDetailsElement>(null);
  const ga = useGoogleAnalytics();

  // in Chrome, the <details> opens automatically when the hash part of a URL
  // matches the `id` on <summary> but needs to be manually handled for Safari
  // and Firefox
  const checkHash = useStableCallback(() => {
    const element = detailsRef.current;
    if (element) {
      const trigger = element.querySelector<HTMLElement>('summary');
      const triggerId = trigger?.getAttribute('id');
      const hash = window.location.hash.slice(1);

      if (triggerId && hash && triggerId === hash) {
        setOpen(true);
      }
    }
  });

  React.useEffect(() => {
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => {
      window.removeEventListener('hashchange', checkHash);
    };
  }, [checkHash]);

  return (
    <details
      {...props}
      ref={detailsRef}
      open={open || undefined}
      className={clsx('AccordionItem', props.className)}
      onToggle={(event) => {
        props.onToggle?.(event);
        setOpen(event.currentTarget.open);
        if (gaCategory && event.currentTarget.open && event.nativeEvent.isTrusted) {
          ga?.trackEvent({
            category: gaCategory,
            action: 'expand',
            label: gaLabel,
            params: gaParams,
          });
        }
      }}
    />
  );
}

export function Panel(props: React.ComponentProps<'div'>) {
  return <div {...props} className={clsx('AccordionPanel', props.className)} />;
}

export function Content(props: React.ComponentProps<'div'>) {
  return <div {...props} className={clsx('AccordionContent', props.className)} />;
}

/* Scroll container with an overscroll overlay graphic for overflowing content inside the trigger */
export function Scrollable({
  children,
  className,
  tag: Tag = 'span',
  gradientColor = 'var(--color-content)',
  ...props
}: React.ComponentProps<'span'> & {
  gradientColor?: string;
  tag?: React.ElementType;
}) {
  return (
    <Tag
      ref={observeScrollableInner}
      className={clsx('AccordionScrollable', className)}
      style={{ '--scrollable-gradient-color': gradientColor } as React.CSSProperties}
      {...props}
    >
      <Tag className="AccordionScrollableInner">{children}</Tag>
    </Tag>
  );
}

/* Fake <tr> */
export function HeaderRow(props: React.ComponentProps<'div'>) {
  return <div {...props} aria-hidden className={clsx('AccordionHeaderRow', props.className)} />;
}

/* Fake <th scope="col"> */
export function HeaderCell(props: React.ComponentProps<'div'>) {
  return <div {...props} className={clsx('AccordionHeaderCell', props.className)} />;
}
