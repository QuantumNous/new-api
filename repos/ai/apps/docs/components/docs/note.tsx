import { Callout } from '@vercel/geistdocs/components/callout';
import type { ReactNode } from 'react';

/**
 * Maps the legacy ai-sdk.dev `<Note>` component (from @vercel/geist) onto the
 * geistdocs callout.
 */
export const Note = ({
  children,
  type,
  className,
}: {
  children: ReactNode;
  type?: 'warning' | 'error';
  className?: string;
}) => (
  <Callout
    className={className}
    type={type === 'warning' ? 'warn' : type === 'error' ? 'error' : 'info'}
  >
    {children}
  </Callout>
);
