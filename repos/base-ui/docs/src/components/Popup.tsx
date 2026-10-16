import * as React from 'react';
import clsx from 'clsx';
import './Popup.css';

export function Popup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={clsx('Popup', className)} {...props} />;
}
