'use client';
import * as React from 'react';

export const ComboboxRowContext = React.createContext(false);

export function useComboboxRowContext() {
  return React.useContext(ComboboxRowContext);
}
