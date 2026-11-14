'use client';
import * as React from 'react';
import { useId } from '@base-ui/utils/useId';
import { ContextMenuRootContext } from './ContextMenuRootContext';
import { Menu } from '../../menu';
import { MenuRootContext } from '../../menu/root/MenuRootContext';
import type { BaseUIChangeEventDetails } from '../../types';
import type { MenuRoot } from '../../menu/root/MenuRoot';

/**
 * A component that creates a context menu activated by right clicking or long pressing.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Context Menu](https://base-ui.com/react/components/context-menu)
 */
export function ContextMenuRoot(props: ContextMenuRoot.Props) {
  const [anchor, setAnchor] = React.useState<ContextMenuRootContext['anchor']>({
    getBoundingClientRect() {
      return DOMRect.fromRect({ width: 0, height: 0, x: 0, y: 0 });
    },
  });

  const backdropRef = React.useRef<HTMLDivElement | null>(null);
  const internalBackdropRef = React.useRef<HTMLDivElement | null>(null);
  const actionsRef: ContextMenuRootContext['actionsRef'] = React.useRef(null);
  const positionerRef = React.useRef<HTMLElement | null>(null);
  const allowMouseUpTriggerRef = React.useRef(true);
  const initialCursorPointRef = React.useRef<{ x: number; y: number } | null>(null);
  const id = useId();

  const contextValue: ContextMenuRootContext = React.useMemo(
    () => ({
      anchor,
      setAnchor,
      actionsRef,
      backdropRef,
      internalBackdropRef,
      positionerRef,
      allowMouseUpTriggerRef,
      initialCursorPointRef,
      rootId: id,
    }),
    [anchor, id],
  );

  return (
    <ContextMenuRootContext.Provider value={contextValue}>
      <MenuRootContext.Provider value={undefined}>
        <Menu.Root {...props} />
      </MenuRootContext.Provider>
    </ContextMenuRootContext.Provider>
  );
}

export interface ContextMenuRootState {}

export interface ContextMenuRootProps extends Omit<
  Menu.Root.Props,
  'modal' | 'openOnHover' | 'delay' | 'closeDelay' | 'onOpenChange'
> {
  /**
   * Event handler called when the menu is opened or closed.
   */
  onOpenChange?:
    | ((open: boolean, eventDetails: ContextMenuRoot.ChangeEventDetails) => void)
    | undefined;
}

export type ContextMenuRootActions = MenuRoot.Actions;
export type ContextMenuRootChangeEventReason = MenuRoot.ChangeEventReason;
export type ContextMenuRootChangeEventDetails =
  BaseUIChangeEventDetails<ContextMenuRoot.ChangeEventReason>;

export namespace ContextMenuRoot {
  export type State = ContextMenuRootState;
  export type Props = ContextMenuRootProps;
  export type Actions = ContextMenuRootActions;
  export type ChangeEventReason = ContextMenuRootChangeEventReason;
  export type ChangeEventDetails = ContextMenuRootChangeEventDetails;
}
