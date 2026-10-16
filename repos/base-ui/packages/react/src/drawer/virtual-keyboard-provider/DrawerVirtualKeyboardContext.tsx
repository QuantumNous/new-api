'use client';
import * as React from 'react';

export interface DrawerVirtualKeyboardContext {
  onTouchStart: (event: React.TouchEvent<Element>) => void;
  // Driven by the viewport's native `touchmove` listener so it still fires when the
  // swipe gesture claims the event with `stopPropagation()`.
  onTouchMove: (event: TouchEvent) => void;
  onTouchEnd: (event: React.TouchEvent<Element>) => void;
  onTouchCancel: () => void;
}

export const DrawerVirtualKeyboardContext = React.createContext<
  DrawerVirtualKeyboardContext | undefined
>(undefined);

export function useDrawerVirtualKeyboardContext() {
  return React.useContext(DrawerVirtualKeyboardContext);
}
