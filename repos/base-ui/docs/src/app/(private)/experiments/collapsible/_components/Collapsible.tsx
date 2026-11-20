'use client';
import * as React from 'react';
import clsx from 'clsx';
import { Collapsible } from '@base-ui/react/collapsible';
import { ChevronRight } from 'lucide-react';
import styles from './Collapsible.module.css';

export function Root({ className, ...props }: Collapsible.Root.Props) {
  return <Collapsible.Root className={clsx(styles.root, className)} {...props} />;
}

export function Trigger({ children, className, ...props }: Collapsible.Trigger.Props) {
  return (
    <Collapsible.Trigger className={clsx(styles.trigger, className)} {...props}>
      <ChevronRight className={styles.icon} />
      {children}
    </Collapsible.Trigger>
  );
}

export function Panel({ className, ...props }: Collapsible.Panel.Props) {
  return <Collapsible.Panel className={clsx(styles.panel, className)} {...props} />;
}

export function Content({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={clsx(styles.content, className)} {...props} />;
}
