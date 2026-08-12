'use client';
import * as React from 'react';

export type MenuGroupContext = (id: string | undefined) => void;

export const MenuGroupContext = React.createContext<MenuGroupContext | undefined>(undefined);

export function useMenuGroupRootContext() {
  const context = React.useContext(MenuGroupContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: MenuGroupContext is missing. Menu group parts must be used within <Menu.Group> or <Menu.RadioGroup>.',
    );
  }

  return context;
}
