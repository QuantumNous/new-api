import * as React from 'react';
import clsx from 'clsx';
import './SkipNav.css';

export const MAIN_CONTENT_ID = 'main-content';
const HREF = `#${MAIN_CONTENT_ID}`;

export function SkipNav({ className, ...props }: React.ComponentProps<'a'>) {
  return <a className={clsx('SkipNav', className)} href={HREF} {...props} />;
}
