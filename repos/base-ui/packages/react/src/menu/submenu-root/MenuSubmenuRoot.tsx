'use client';
import * as React from 'react';
import { MenuRoot } from '../root/MenuRoot';
import { useMenuRootContext } from '../root/MenuRootContext';
import { MenuSubmenuRootContext } from './MenuSubmenuRootContext';

export { useMenuSubmenuRootContext } from './MenuSubmenuRootContext';

/**
 * Groups all parts of a submenu.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuSubmenuRoot(props: MenuSubmenuRoot.Props) {
  const parentMenu = useMenuRootContext().store;

  const contextValue = React.useMemo(() => ({ parentMenu }), [parentMenu]);

  return (
    <MenuSubmenuRootContext.Provider value={contextValue}>
      <MenuRoot {...props} />
    </MenuSubmenuRootContext.Provider>
  );
}

export interface MenuSubmenuRootProps extends Omit<
  MenuRoot.Props,
  | 'modal'
  | 'openOnHover'
  | 'onOpenChange'
  | 'handle'
  | 'triggerId'
  | 'defaultTriggerId'
  | 'children'
> {
  /**
   * Event handler called when the menu is opened or closed.
   */
  onOpenChange?:
    | ((open: boolean, eventDetails: MenuSubmenuRoot.ChangeEventDetails) => void)
    | undefined;
  /**
   * When in a submenu, determines whether pressing the Escape key
   * closes the entire menu, or only the current child menu.
   * @default false
   */
  closeParentOnEsc?: boolean | undefined;
  /**
   * The content of the submenu.
   */
  children?: React.ReactNode;
}

export interface MenuSubmenuRootState {}

export type MenuSubmenuRootChangeEventReason = MenuRoot.ChangeEventReason;
export type MenuSubmenuRootChangeEventDetails = MenuRoot.ChangeEventDetails;

export namespace MenuSubmenuRoot {
  export type Props = MenuSubmenuRootProps;
  export type State = MenuSubmenuRootState;
  export type ChangeEventReason = MenuSubmenuRootChangeEventReason;
  export type ChangeEventDetails = MenuSubmenuRootChangeEventDetails;
}
