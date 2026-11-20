'use client';
import * as React from 'react';
import { MenuStore } from '../store/MenuStore';

export const MenuSubmenuRootContext = React.createContext<MenuSubmenuRootContext | undefined>(
  undefined,
);

export interface MenuSubmenuRootContext {
  parentMenu: MenuStore<unknown>;
}

export function useMenuSubmenuRootContext(): MenuSubmenuRootContext | undefined {
  return React.useContext(MenuSubmenuRootContext);
}
