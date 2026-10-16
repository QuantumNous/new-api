'use client';
import * as React from 'react';
import type { UseAnchorPositioningReturnValue } from '../../utils/useAnchorPositioning';

export type ComboboxPositionerContext = Pick<
  UseAnchorPositioningReturnValue,
  | 'side'
  | 'align'
  | 'arrowRef'
  | 'arrowUncentered'
  | 'arrowStyles'
  | 'anchorHidden'
  | 'isPositioned'
>;

export const ComboboxPositionerContext = React.createContext<ComboboxPositionerContext | undefined>(
  undefined,
);

export function useComboboxPositionerContext(optional?: false): ComboboxPositionerContext;
export function useComboboxPositionerContext(optional: true): ComboboxPositionerContext | undefined;
export function useComboboxPositionerContext(optional?: boolean) {
  const context = React.useContext(ComboboxPositionerContext);
  if (context === undefined && !optional) {
    throw new Error(
      'Base UI: <Combobox.Popup> and <Combobox.Arrow> must be used within the <Combobox.Positioner> component',
    );
  }
  return context;
}
