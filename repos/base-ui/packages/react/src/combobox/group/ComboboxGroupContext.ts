'use client';
import * as React from 'react';

export interface ComboboxGroupContext {
  labelId: string | undefined;
  setLabelId: React.Dispatch<React.SetStateAction<string | undefined>>;
  /**
   * Optional list of items that belong to this group. Used by nested
   * collections to render group-specific items.
   */
  items?: readonly any[] | undefined;
}

export const ComboboxGroupContext = React.createContext<ComboboxGroupContext | undefined>(
  undefined,
);

export function useComboboxGroupContext() {
  const context = React.useContext(ComboboxGroupContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: ComboboxGroupContext is missing. ComboboxGroup parts must be placed within <Combobox.Group>.',
    );
  }
  return context;
}
