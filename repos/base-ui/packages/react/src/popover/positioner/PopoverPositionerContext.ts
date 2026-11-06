'use client';
import * as React from 'react';
import type { Side, Align } from '../../utils/useAnchorPositioning';
import type { FloatingContext } from '../../floating-ui-react';

export interface PopoverPositionerContext {
  side: Side;
  align: Align;
  arrowRef: React.RefObject<Element | null>;
  arrowUncentered: boolean;
  arrowStyles: React.CSSProperties;
  context: FloatingContext;
}

export const PopoverPositionerContext = React.createContext<PopoverPositionerContext | undefined>(
  undefined,
);

export function usePopoverPositionerContext() {
  const context = React.useContext(PopoverPositionerContext);
  if (!context) {
    throw new Error(
      'Base UI: PopoverPositionerContext is missing. PopoverPositioner parts must be placed within <Popover.Positioner>.',
    );
  }
  return context;
}
