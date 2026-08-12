'use client';
import * as React from 'react';
import type { RadioRootState } from './RadioRoot';

export type RadioRootContext = RadioRootState;

export const RadioRootContext = React.createContext<RadioRootContext | undefined>(undefined);

export function useRadioRootContext() {
  const value = React.useContext(RadioRootContext);
  if (value === undefined) {
    throw new Error(
      'Base UI: RadioRootContext is missing. Radio parts must be placed within <Radio.Root>.',
    );
  }

  return value;
}
