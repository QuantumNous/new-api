import * as React from 'react';

export function Unsplash(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" {...props}>
      <g clipPath="url(#clip0_88_3022)">
        <path d="M10 9V0H22V9H10ZM22 14H32V32H0V14H10V23H22V14Z" fill="currentColor" />
      </g>
      <defs>
        <clipPath id="clip0_88_3022">
          <rect width="32" height="32" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}
