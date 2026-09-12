'use client';
import * as React from 'react';
import { DemoContext } from './DemoContext';

export const DemoPlayground = React.forwardRef(function DemoPlayground(
  props: DemoPlayground.Props,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const demoContext = React.useContext(DemoContext);
  if (!demoContext) {
    throw new Error('Demo.Playground must be used within a Demo.Root');
  }

  const { selectedVariant } = demoContext;

  const { component: DemoComponent } = selectedVariant;

  return (
    <div {...props} ref={ref}>
      <DemoComponent />
    </div>
  );
});

export namespace DemoPlayground {
  export interface Props extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
  }
}
