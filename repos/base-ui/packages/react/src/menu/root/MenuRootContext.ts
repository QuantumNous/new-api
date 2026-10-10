'use client';
import * as React from 'react';
import { type MenuStore } from '../store/MenuStore';
import { MenuParent } from './MenuRoot';

export interface MenuRootContext<Payload = unknown> {
  store: MenuStore<Payload>;
  parent: MenuParent;
}

export const MenuRootContext = React.createContext<MenuRootContext | undefined>(undefined);

export function useMenuRootContext(optional?: false): MenuRootContext;
export function useMenuRootContext(optional: true): MenuRootContext | undefined;
export function useMenuRootContext(optional?: boolean) {
  const context = React.useContext(MenuRootContext);
  if (context === undefined && !optional) {
    throw new Error(
      'Base UI: MenuRootContext is missing. Menu parts must be placed within <Menu.Root>.',
    );
  }

  return context;
}
