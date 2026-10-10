'use client';
import * as React from 'react';

export interface SelectGroupContext {
  labelId: string | undefined;
  setLabelId: React.Dispatch<React.SetStateAction<string | undefined>>;
}

export const SelectGroupContext = React.createContext<SelectGroupContext | undefined>(undefined);

export function useSelectGroupContext() {
  const context = React.useContext(SelectGroupContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: SelectGroupContext is missing. SelectGroup parts must be placed within <Select.Group>.',
    );
  }
  return context;
}
