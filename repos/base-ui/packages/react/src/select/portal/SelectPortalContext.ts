'use client';
import * as React from 'react';

export const SelectPortalContext = React.createContext<boolean | undefined>(undefined);

export function useSelectPortalContext() {
  const value = React.useContext(SelectPortalContext);
  if (value === undefined) {
    throw new Error('Base UI: <Select.Portal> is missing.');
  }
  return value;
}
