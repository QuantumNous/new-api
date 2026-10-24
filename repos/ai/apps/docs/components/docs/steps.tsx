import type { ComponentProps } from 'react';

export const Steps = ({ children, ...props }: ComponentProps<'div'>) => (
  <div
    className="docs-steps mt-4 mb-12 ml-4 border-gray-alpha-400 border-l pl-8"
    {...props}
  >
    {children}
  </div>
);
