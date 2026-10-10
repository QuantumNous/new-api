'use client';
import * as React from 'react';

export interface NumberFieldScrubAreaContext {
  isScrubbing: boolean;
  isTouchInput: boolean;
  isPointerLockDenied: boolean;
  scrubAreaCursorRef: React.RefObject<HTMLSpanElement | null>;
}

export const NumberFieldScrubAreaContext = React.createContext<
  NumberFieldScrubAreaContext | undefined
>(undefined);

export function useNumberFieldScrubAreaContext() {
  const context = React.useContext(NumberFieldScrubAreaContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: NumberFieldScrubAreaContext is missing. NumberFieldScrubArea parts must be placed within <NumberField.ScrubArea>.',
    );
  }
  return context;
}
