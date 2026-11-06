import * as React from 'react';

export function MinusIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      className="Icon"
      {...props}
    >
      <path d="M1.5 8h13" />
    </svg>
  );
}
