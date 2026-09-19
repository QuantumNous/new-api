'use client';
import * as React from 'react';
import type { UseCollapsibleRootReturnValue } from './useCollapsibleRoot';
import type { CollapsibleRoot, CollapsibleRootState } from './CollapsibleRoot';

export interface CollapsibleRootContext extends UseCollapsibleRootReturnValue {
  onOpenChange: (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => void;
  state: CollapsibleRootState;
}

export const CollapsibleRootContext = React.createContext<CollapsibleRootContext | undefined>(
  undefined,
);

export function useCollapsibleRootContext() {
  const context = React.useContext(CollapsibleRootContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: CollapsibleRootContext is missing. Collapsible parts must be placed within <Collapsible.Root>.',
    );
  }

  return context;
}
