'use client';
import * as React from 'react';
import type { Orientation } from '../../internals/types';
import type { CompositeMetadata } from '../../internals/composite/list/CompositeList';
import type { ToolbarRoot } from './ToolbarRoot';

export interface ToolbarRootContext {
  disabled: boolean;
  orientation: Orientation;
  setItemMap: React.Dispatch<
    React.SetStateAction<Map<Node, CompositeMetadata<ToolbarRoot.ItemMetadata> | null>>
  >;
}

export const ToolbarRootContext = React.createContext<ToolbarRootContext | undefined>(undefined);

export function useToolbarRootContext(optional?: false): ToolbarRootContext;
export function useToolbarRootContext(optional: true): ToolbarRootContext | undefined;
export function useToolbarRootContext(optional?: boolean) {
  const context = React.useContext(ToolbarRootContext);
  if (context === undefined && !optional) {
    throw new Error(
      'Base UI: ToolbarRootContext is missing. Toolbar parts must be placed within <Toolbar.Root>.',
    );
  }

  return context;
}
