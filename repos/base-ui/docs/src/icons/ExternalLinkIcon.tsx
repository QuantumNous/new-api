import * as React from 'react';

export function ExternalLinkIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="square" strokeLinejoin="round" d="m4 12 8-8" />
      <path d="M5 3.5h7.5V11" />
    </svg>
  );
}
