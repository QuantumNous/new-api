'use client';
import * as React from 'react';
import type { ProgressStatus, ProgressRootState } from './ProgressRoot';

export type ProgressRootContext = {
  /**
   * Formatted value of the component.
   */
  formattedValue: string;
  /**
   * The maximum value.
   */
  max: number;
  /**
   * The minimum value.
   */
  min: number;
  /**
   * Value of the component.
   */
  value: number | null;
  setLabelId: React.Dispatch<React.SetStateAction<string | undefined>>;
  state: ProgressRootState;
  status: ProgressStatus;
};

/**
 * @internal
 */
export const ProgressRootContext = React.createContext<ProgressRootContext | undefined>(undefined);

export function useProgressRootContext() {
  const context = React.useContext(ProgressRootContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: ProgressRootContext is missing. Progress parts must be placed within <Progress.Root>.',
    );
  }

  return context;
}
