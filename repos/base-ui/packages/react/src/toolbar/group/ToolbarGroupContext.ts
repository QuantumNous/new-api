'use client';
import * as React from 'react';

export interface ToolbarGroupContext {
  disabled: boolean;
}

export const ToolbarGroupContext = React.createContext<ToolbarGroupContext | undefined>(undefined);

export function useToolbarGroupContext(optional?: false): ToolbarGroupContext;
export function useToolbarGroupContext(optional: true): ToolbarGroupContext | undefined;
export function useToolbarGroupContext(optional?: boolean) {
  const context = React.useContext(ToolbarGroupContext);
  if (context === undefined && !optional) {
    throw new Error(
      'Base UI: ToolbarGroupContext is missing. ToolbarGroup parts must be placed within <Toolbar.Group>.',
    );
  }
  return context;
}
