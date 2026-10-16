'use client';
import * as React from 'react';
import clsx from 'clsx';
import { observeScrollableInner } from '../utils/observeScrollableInner';

export function Root({ className, children, ...other }: React.ComponentProps<'div'>) {
  return (
    <div className={clsx('TableRoot', className)} {...other}>
      <table className="TableRootTable">{children}</table>
    </div>
  );
}

export function Head(props: React.ComponentProps<'thead'>) {
  return <thead {...props} className={clsx('TableHead', props.className)} />;
}

export function Body(props: React.ComponentProps<'tbody'>) {
  return <tbody {...props} className={clsx('TableBody', props.className)} />;
}

export function Row(props: React.ComponentProps<'tr'>) {
  return <tr {...props} className={clsx('TableRow', props.className)} />;
}

export function ColumnHeader({
  children,
  className,
  ...other
}: Omit<React.ComponentProps<'th'>, 'scope'>) {
  return (
    <th scope="col" className={clsx('TableColumnHeader', className)} {...other}>
      <span className="TableCellInner">{children}</span>
    </th>
  );
}

export function RowHeader({
  children,
  className,
  ...other
}: Omit<React.ComponentProps<'th'>, 'scope'>) {
  return (
    <th
      scope="row"
      ref={observeScrollableInner}
      className={clsx('TableCell', className)}
      {...other}
    >
      <span className="TableCellInner">{children}</span>
    </th>
  );
}

export function Cell({ children, className, ...other }: React.ComponentProps<'td'>) {
  return (
    <td ref={observeScrollableInner} className={clsx('TableCell', className)} {...other}>
      <span className="TableCellInner">{children}</span>
    </td>
  );
}
