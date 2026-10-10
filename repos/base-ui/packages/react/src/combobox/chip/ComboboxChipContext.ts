'use client';
import * as React from 'react';

export interface ComboboxChipContext {
  index: number;
}

export const ComboboxChipContext = React.createContext<ComboboxChipContext | undefined>(undefined);

export function useComboboxChipContext() {
  const context = React.useContext(ComboboxChipContext);
  if (!context) {
    throw new Error(
      'Base UI: ComboboxChipContext is missing. ComboboxChip parts must be placed within <Combobox.Chip>.',
    );
  }
  return context;
}
