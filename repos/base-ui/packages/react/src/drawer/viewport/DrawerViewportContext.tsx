'use client';
import * as React from 'react';

interface DrawerViewportContextValue {
  swiping: boolean;
  getDragStyles: () => React.CSSProperties;
  swipeStrength: number | null;
  setSwipeDismissed: (dismissed: boolean) => void;
}

export const DrawerViewportContext = React.createContext<DrawerViewportContextValue | null>(null);

export function useDrawerViewportContext(optional?: false): DrawerViewportContextValue;
export function useDrawerViewportContext(optional: true): DrawerViewportContextValue | null;
export function useDrawerViewportContext(optional?: boolean) {
  const context = React.useContext(DrawerViewportContext);

  if (optional === false && context === null) {
    throw new Error(
      'Base UI: DrawerViewportContext is missing. Drawer parts must be placed within <Drawer.Viewport>.',
    );
  }

  return context;
}
