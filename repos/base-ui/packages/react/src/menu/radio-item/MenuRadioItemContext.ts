'use client';
import * as React from 'react';

export interface MenuRadioItemContext {
  checked: boolean;
  highlighted: boolean;
  disabled: boolean;
}

export const MenuRadioItemContext = React.createContext<MenuRadioItemContext | undefined>(
  undefined,
);

export function useMenuRadioItemContext() {
  const context = React.useContext(MenuRadioItemContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: MenuRadioItemContext is missing. MenuRadioItem parts must be placed within <Menu.RadioItem>.',
    );
  }

  return context;
}
