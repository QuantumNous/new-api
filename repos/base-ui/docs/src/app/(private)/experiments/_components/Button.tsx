import * as React from 'react';
import clsx from 'clsx';
import classes from './Button.module.css';
import { Tooltip } from './Tooltip';

export function Button(props: ButtonProps) {
  const { children, className, variant, fullWidth = false, tooltip, ...otherProps } = props;
  const button = (
    <button
      type="button"
      {...otherProps}
      className={clsx(classes.root, classes[variant], fullWidth && classes.fullWidth, className)}
    >
      {children}
    </button>
  );

  if (tooltip) {
    return <Tooltip text={tooltip}>{button}</Tooltip>;
  }

  return button;
}

export interface ButtonProps extends React.HTMLAttributes<HTMLButtonElement> {
  variant: 'text';
  fullWidth?: boolean;
  tooltip?: string;
}
