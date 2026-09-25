'use client';
import * as React from 'react';
import clsx from 'clsx';
import { Accordion } from '@base-ui/react/accordion';
import { Plus } from 'lucide-react';
import styles from './Accordion.module.css';

export function Root<Value = any>({ className, ...props }: Accordion.Root.Props<Value>) {
  return <Accordion.Root className={clsx(styles.root, className)} {...props} />;
}

export function Item({ className, ...props }: Accordion.Item.Props) {
  return <Accordion.Item className={clsx(styles.item, className)} {...props} />;
}

export function Header({ className, ...props }: Accordion.Header.Props) {
  return <Accordion.Header className={clsx(styles.header, className)} {...props} />;
}

export function Trigger({ children, className, ...props }: Accordion.Trigger.Props) {
  return (
    <Accordion.Trigger className={clsx(styles.trigger, className)} {...props}>
      {children}
      <Plus className={styles.icon} />
    </Accordion.Trigger>
  );
}

export function Panel({ className, ...props }: Accordion.Panel.Props) {
  return <Accordion.Panel className={clsx(styles.panel, className)} {...props} />;
}

export function Content({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={clsx(styles.content, className)} {...props} />;
}
