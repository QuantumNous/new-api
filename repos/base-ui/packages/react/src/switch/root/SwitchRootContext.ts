'use client';
import * as React from 'react';
import type { SwitchRootState } from './SwitchRoot';

export type SwitchRootContext = SwitchRootState;

export const SwitchRootContext = React.createContext<SwitchRootContext | undefined>(undefined);

export function useSwitchRootContext() {
  const context = React.useContext(SwitchRootContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: SwitchRootContext is missing. Switch parts must be placed within <Switch.Root>.',
    );
  }

  return context;
}
