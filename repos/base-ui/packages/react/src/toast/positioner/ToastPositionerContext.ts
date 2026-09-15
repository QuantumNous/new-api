'use client';
import * as React from 'react';
import type { UseAnchorPositioningReturnValue } from '../../utils/useAnchorPositioning';

export type ToastPositionerContext = Pick<
  UseAnchorPositioningReturnValue,
  'side' | 'align' | 'arrowRef' | 'arrowUncentered' | 'arrowStyles'
>;

export const ToastPositionerContext = React.createContext<ToastPositionerContext | undefined>(
  undefined,
);

export function useToastPositionerContext() {
  const context = React.useContext(ToastPositionerContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: ToastPositionerContext is missing. ToastPositioner parts must be placed within <Toast.Positioner>.',
    );
  }
  return context;
}
