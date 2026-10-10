'use client';
import * as React from 'react';
import type { ContextMenuRoot } from './ContextMenuRoot';

export interface ContextMenuRootContext {
  anchor: { getBoundingClientRect: () => DOMRect };
  setAnchor: React.Dispatch<React.SetStateAction<ContextMenuRootContext['anchor']>>;
  backdropRef: React.RefObject<HTMLDivElement | null>;
  internalBackdropRef: React.RefObject<HTMLDivElement | null>;
  actionsRef: React.RefObject<{
    setOpen: (nextOpen: boolean, eventDetails: ContextMenuRoot.ChangeEventDetails) => void;
  } | null>;
  positionerRef: React.RefObject<HTMLElement | null>;
  allowMouseUpTriggerRef: React.RefObject<boolean>;
  initialCursorPointRef: React.RefObject<{ x: number; y: number } | null>;
  rootId: string | undefined;
}

export const ContextMenuRootContext = React.createContext<ContextMenuRootContext | undefined>(
  undefined,
);

export function useContextMenuRootContext(optional: false): ContextMenuRootContext;
export function useContextMenuRootContext(optional?: true): ContextMenuRootContext | undefined;
export function useContextMenuRootContext(optional = true) {
  const context = React.useContext(ContextMenuRootContext);
  if (context === undefined && !optional) {
    throw new Error(
      'Base UI: ContextMenuRootContext is missing. ContextMenu parts must be placed within <ContextMenu.Root>.',
    );
  }
  return context;
}
