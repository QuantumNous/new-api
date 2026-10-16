'use client';
import * as React from 'react';

export interface ScrollAreaScrollbarContext {
  orientation: 'horizontal' | 'vertical';
}

export const ScrollAreaScrollbarContext = React.createContext<
  ScrollAreaScrollbarContext | undefined
>(undefined);

export function useScrollAreaScrollbarContext() {
  const context = React.useContext(ScrollAreaScrollbarContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: ScrollAreaScrollbarContext is missing. ScrollAreaScrollbar parts must be placed within <ScrollArea.Scrollbar>.',
    );
  }
  return context;
}
