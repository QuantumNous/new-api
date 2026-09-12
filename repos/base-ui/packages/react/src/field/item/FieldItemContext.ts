'use client';
import * as React from 'react';

export interface FieldItemContext {
  disabled: boolean;
}

export const FieldItemContext = React.createContext<FieldItemContext>({ disabled: false });

export function useFieldItemContext() {
  const context = React.useContext(FieldItemContext);

  return context;
}
