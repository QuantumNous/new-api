import c from 'clsx';
import * as React from 'react';
import styles from './Button.module.css';

/** @internal */
export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function Button(props, ref) {
  return (
    // eslint-disable-next-line react/button-has-type
    <button {...props} ref={ref} className={c(props.className, styles.Button)} />
  );
});
