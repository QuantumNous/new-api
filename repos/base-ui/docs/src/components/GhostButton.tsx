import clsx from 'clsx';
import * as React from 'react';
import './GhostButton.css';

interface GhostButtonProps extends React.ComponentProps<'button'> {
  layout?: 'text' | 'icon';
}

export function GhostButton({ className, layout = 'text', ...props }: GhostButtonProps) {
  return (
    <button
      data-layout={layout}
      type="button"
      className={clsx('GhostButton', className)}
      {...props}
    />
  );
}
