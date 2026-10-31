import * as React from 'react';

export function Paper(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" {...props}>
      <path
        d="M19.6749 0H4.91873V4.92314H19.6749V19.6923H4.91873V4.92314H0V19.6923V32H4.91873H19.6749V19.6923H31.9717V4.92314V0H19.6749Z"
        fill="currentColor"
      />
    </svg>
  );
}
