import * as React from 'react';

export function NpmIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg fill="currentColor" width="16" height="16" viewBox="0 0 16 16" {...props}>
      <rect width="16" height="16" fill="black" />
      <rect x="3" y="3" width="10" height="10" fill="white" />
      <path d="M8 5H11V13H8V5Z" fill="black" />
    </svg>
  );
}
