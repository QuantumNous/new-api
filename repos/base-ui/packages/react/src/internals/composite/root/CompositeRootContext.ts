'use client';
import * as React from 'react';

export interface CompositeRootContext {
  highlightedIndex: number;
  onHighlightedIndexChange: (index: number, shouldScrollIntoView?: boolean) => void;
  highlightItemOnHover: boolean;
  /**
   * Makes it possible to control composite components using events that don't originate from their children.
   * For example, a Menubar with detached triggers may define its Menu.Root outside of CompositeRoot.
   * Keyboard events that occur within this menu won't normally be captured by the CompositeRoot,
   * so they need to be forwarded manually using this function.
   */
  relayKeyboardEvent: (event: React.KeyboardEvent<any>) => void;
}

export const CompositeRootContext = React.createContext<CompositeRootContext | undefined>(
  undefined,
);

export function useCompositeRootContext(optional: true): CompositeRootContext | undefined;
export function useCompositeRootContext(optional?: false): CompositeRootContext;
export function useCompositeRootContext(optional = false) {
  const context = React.useContext(CompositeRootContext);
  if (context === undefined && !optional) {
    throw new Error(
      'Base UI: CompositeRootContext is missing. Composite parts must be placed within <Composite.Root>.',
    );
  }

  return context;
}
